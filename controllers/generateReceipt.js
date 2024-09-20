import { createReceipt } from '../createReceipt.js';
import { Storage } from '@google-cloud/storage';
import { sendOrderSummary } from '../sendMail.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { client } from '../sanityClient.js';
import mime from 'mime-types';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check session for logged-in user
const checkSession = async (req, knex) => {
    if (req.session && req.session.userEmail) {
        try {
            const response = await knex.select('*')
                .from('users')
                .where('email', '=', req.session.userEmail);

            if (response.length > 0) {
                return { sessionStatus: true, profileData: response[0] };
            }
        } catch (err) {
            console.error(err);
            return { sessionStatus: false, profileData: 'Guest' };
        }
    }
    return { sessionStatus: false, profileData: 'Guest' };
};

// Generate a receipt number based on the receipt ID and the current date
const generateReceiptNr = async (receiptId) => {
    const date = new Date();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${receiptId}${day}${month}${year}`;
};

// Upload the generated receipt to Google Cloud Storage and return the signed URL
const uploadReceiptToCloud = async (fileName, filePath) => {
    try {
        // Correctly resolve the path to the service account JSON file
        const credentialsPath = path.join(__dirname, process.env.GOOGLE_CLOUD_PATH);

        // Initialize Google Cloud Storage client using credentials from the .env file
        const storage = new Storage({
            keyFilename: credentialsPath, // Resolve path correctly
            projectId: process.env.GOOGLE_CLOUD_PROJECT_ID, // Load project ID from .env
        });

        const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME; // Load bucket name from .env
        const destFileName = fileName;

        // Determine the content type of the file dynamically
        const contentType = mime.lookup(filePath) || 'application/octet-stream';

        // Upload the file to Google Cloud Storage
        await storage.bucket(bucketName).upload(filePath, {
            destination: destFileName,
            metadata: {
                contentType: contentType, // Set content type dynamically
            },
        });

        // Generate a signed URL for the uploaded file
        const [signedUrl] = await storage.bucket(bucketName).file(destFileName).getSignedUrl({
            action: 'read', // Set file to be readable
            expires: '03-17-2025', // Expiration date for signed URL
        });

        return signedUrl; // Return the signed URL
    } catch (error) {
        console.error('Error during file upload to Cloud Storage:', error.message); // Log error details
        throw new Error('Failed to upload receipt to cloud'); // Throw an error for higher-level handling
    }
};


// Update the stock levels for each product in the order
const updateStockLevel = async (orderItems) => {
    try {
        if (!Array.isArray(orderItems)) {
            throw new Error('orderItems should be an array');
        }

        const groupedItems = orderItems.reduce((acc, item) => {
            const key = `${item.slug}-${item.size}`;
            if (!acc[key]) {
                acc[key] = { ...item };
            } else {
                acc[key].quantity += item.quantity;
            }
            return acc;
        }, {});

        for (const key in groupedItems) {
            const item = groupedItems[key];

            if (item && item.size && item.slug) {
                const { slug, size, quantity } = item;

                const product = await client.fetch(
                    `*[_type == "product" && slug.current == $slug][0]`,
                    { slug }
                );

                if (product) {
                    const sizeIndex = product.sizes.findIndex((s, i) => i % 2 === 0 && s === size);

                    if (sizeIndex !== -1) {
                        const updatedStock = product.sizes[sizeIndex + 1] - quantity;

                        if (updatedStock >= 0) {
                            const updatedSizes = [...product.sizes];
                            updatedSizes[sizeIndex + 1] = updatedStock;

                            await client.patch(product._id).set({ sizes: updatedSizes }).commit();
                            console.log(`Updated stock for ${slug} - size ${size} to ${updatedStock}`);
                        } else {
                            console.error(`Not enough stock for ${slug} - size ${size}`);
                        }
                    } else {
                        console.error(`Size ${size} not found for product ${slug}`);
                    }
                } else {
                    console.error(`Product with slug ${slug} not found`);
                }
            } else {
                console.error('Invalid item data:', item);
            }
        }
    } catch (error) {
        console.error('Error updating stock:', error.message);
    }
};

// Handle the receipt generation and other related tasks (e.g., stock updates, email sending)
export const handleGenerateReceipt = async (req, res, knex) => {
    try {
        const receiptData = req.body;

        let { sessionStatus, profileData } = await checkSession(req, knex);

        const [orderId] = await knex('orders')
            .returning('id')
            .insert({
                receiver: `${receiptData.name} ${receiptData.surname}`,
                address: receiptData.address,
                total_amount: receiptData.total,
                order_status: 'Pending',
                mentions: receiptData.additionalInfo,
                delivery_method: receiptData.delivery_method,
                is_guest: sessionStatus,
                user_id: profileData.id
            });

        const [receiptId] = await knex('receipts')
            .returning('id')
            .insert({
                order_id: orderId.id
            });

        receiptData.receipt_nr = await generateReceiptNr(receiptId.id);

        const filename = `receipt-${receiptData.receipt_nr}.pdf`;
        const filePath = await createReceipt(receiptData, filename);

        // Upload the receipt to the cloud
        receiptData.receipt_url = await uploadReceiptToCloud(filename, filePath);

        // Insert the receipt URL into the database
        await knex('receipts')
            .where('id', receiptId.id)
            .update({ receipt_url: receiptData.receipt_url });

        // Send the email with order summary and receipt
        await sendOrderSummary(receiptData.email, receiptData, orderId.id, filename, filePath);

        // Update stock levels after the order
        await updateStockLevel(receiptData.items);

        // Return a success response
        res.status(200).json({ message: 'Order placed successfully', orderId: orderId.id });
    } catch (error) {
        console.error('Error generating or uploading receipt:', error);
        res.status(500).json({ error: 'Failed to generate or upload receipt' });
    }
};
