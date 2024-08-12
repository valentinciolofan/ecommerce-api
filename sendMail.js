// src/sendEmail.js
import transporter from './emailConfig.js';
import fs from 'fs';
import handlebars from 'handlebars';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const loadTemplate = (templateName, replacements) => {
  const filePath = path.join(__dirname, 'emails', `${templateName}.html`); // Ensure this path is correct
  const source = fs.readFileSync(filePath, 'utf-8').toString();
  const template = handlebars.compile(source);
  return template(replacements);
};

const sendOrderSummary = async (email, orderData, order_id, filename, filePath) => {
  const formattedItems = orderData.items.map(item => `
    <tr>
      <td style="border: 1px solid #dddddd; text-align: left; padding: 8px;">${item.title}</td>
      <td style="border: 1px solid #dddddd; text-align: left; padding: 8px;">${item.quantity}</td>
      <td style="border: 1px solid #dddddd; text-align: left; padding: 8px;">$${item.price}</td>
      <td style="border: 1px solid #dddddd; text-align: left; padding: 8px;">$${item.quantity * item.price}</td>
    </tr>
  `).join('');

  const htmlContent = loadTemplate('emailTemplate', {
    order_id: order_id,
    name: `${orderData.surname} ${orderData.name}`,
    orderItems: formattedItems, 
    totalAmount: orderData.total,
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Your Order Summary',
    html: htmlContent,
    attachments: [
      {
        filename: filename,
        path: filePath,
        contentType: 'application/pdf'
      }
    ],
  };
  

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

export { sendOrderSummary };
  