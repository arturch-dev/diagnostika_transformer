export default function handler(req, res) {
  // WayForPay sends POST data to returnUrl.
  // Vercel static files (thanks.html) don't accept POST (HTTP 405).
  // This function receives the POST and redirects to the HTML via GET.
  const status = req.body?.transactionStatus || 'Approved';
  const urlParams = new URLSearchParams(req.query);
  if (status) urlParams.set('transactionStatus', status);
  
  res.redirect(302, `/thanks.html?${urlParams.toString()}`);
}
