const express = require('express');
const cors = require('cors');
const app = express()
const port = process.env.PORT || 5000

// middlewares
app.use(cors())
app.use(express.json())

app.get('/',(req,res)=>{
    res.send('hey there')
})

app.listen(port,()=>{
    console.log(`SocialPod is waiting at: ${port} `);
})