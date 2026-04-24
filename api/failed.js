export default function handler(req, res) {
  // Handle declined payments on Vercel by redirecting POST to GET
  const status = req.body?.transactionStatus || 'Declined';
  const urlParams = new URLSearchParams(req.query);
  if (status) urlParams.set('transactionStatus', status);
  
  res.redirect(302, `/failed.html?${urlParams.toString()}`);
}
