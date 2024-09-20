export const handleUpdateProfile = async (req, res) => {
    const userEmail = req.session?.userEmail; // Assuming you have user email stored in session
    if (!userEmail) {
      console.error('Unauthorized: No userEmail in session');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const updates = req.body;
    try {
      const updateResult = await knex('users')
        .where({ email: userEmail })
        .update(updates);
  
      if (updateResult === 0) {
        console.error('No rows updated, possible invalid userEmail');
        return res.status(404).json({ error: 'User not found' });
      }
      res.status(200).json({ message: 'Profile updated successfully' });
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }