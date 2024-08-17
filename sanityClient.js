import { createClient } from '@sanity/client';

export const client = createClient({
  projectId: '1ymeft4k', // replace with your Sanity project ID
  dataset: 'production', // replace with your dataset
  useCdn: false,         // `false` if you want to ensure fresh data
  token: process.env.SANITY_WRITE_TOKEN, // Sanity API token with write access
  apiVersion: '2021-08-31', // use the most recent date or the API version you want to target
});
