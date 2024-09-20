import { contactUsMail } from '../sendMail.js';


export const handleContact = async (req, res) => {
    const { name, email, message } = req.body;
  
    // Check if all required fields are filled
    if (!email || !name || !message) {
      res.status(400).send('You need to fill all input fields!');
      return; // Exit the function early if validation fails
    }
  
    try {
      await contactUsMail(email, name, message);
      res.sendStatus(200); // Respond with 200 OK if the email is sent successfully
    } catch (error) {
      console.error('Error sending contact email:', error);
      res.status(500).send('There was an error sending your message. Please try again later.');
    }
  }