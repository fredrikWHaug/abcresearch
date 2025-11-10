/**
 * Manual Worker Trigger Script
 * 
 * Use this to manually trigger the worker for a stuck job
 * Run: node trigger-worker-manual.js <jobId>
 */

const jobId = process.argv[2] || '9cc391a5-e8b6-4fff-810a-c412ab0a3ada'
const fileKey = `pdf-jobs/4211873e-031d-4816-b95b-b6d5e162cb19/1762748212037-JACC-Interplay of Chronic Kidney Disease and the Effects of Tirzepatide in Patients With Heart Failure, Preserved Ejection Fraction, and Obesity (1).pdf`

console.log('Triggering worker for job:', jobId)

fetch('http://localhost:3000/api/process-pdf-job', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-internal-key': 'dev-key'
  },
  body: JSON.stringify({
    jobId: jobId,
    fileKey: fileKey
  })
})
.then(res => res.json())
.then(data => {
  console.log('Worker response:', data)
})
.catch(err => {
  console.error('Error:', err.message)
})

