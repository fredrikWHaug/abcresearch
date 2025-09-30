export default function handler(req, res) {
  res.status(200).json({ 
    message: 'Node.js function works!',
    method: req.method,
    body: req.body
  });
}
