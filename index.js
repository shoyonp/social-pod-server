const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// middlewares
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.o3uzo.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const postCollection = client.db("socialPod").collection("posts");
    const commentCollection = client.db("socialPod").collection("comments");

    // post a new data
    app.post("/newPost", async (req, res) => {
      const postData = req.body;
      const result = await postCollection.insertOne(postData);
      res.send(result);
    });

    // get all posts data
    app.get("/post", async (req, res) => {
      const result = await postCollection.find().toArray();
      res.send(result);
    });

    // manage upvote and downvote
    app.patch("/post/:id", async (req, res) => {
      const id = req.params.id;
      const { type } = req.body;
      const filter = { _id: new ObjectId(id) };
      let updateDoc = {};
      if (type === "upVote") {
        updateDoc = {
          $inc: { upVote: 1 },
        };
      } else {
        updateDoc = {
          $inc: { downVote: 1 },
        };
      }
      const result = await postCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // get the posts data user added
    app.get("/myPost/:email", async (req, res) => {
      const email = req.params.email;
      const query = { authorEmail: email };
      const result = await postCollection.find(query).toArray();
      res.send(result);
    });

    // delete a post data
    app.delete("/deletePost/:id", async (req, res) => {
      const id = req.params.id;
      //   console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await postCollection.deleteOne(query);
      res.send(result);
    });

    // post comment data
    app.post("/comments", async (req, res) => {
      const commentData = req.body;
      const result = await commentCollection.insertOne(commentData);
      res.send(result);
    });

    // get specific posts comment data by title
    app.get("/comments/:title", async (req, res) => {
      const title = req.params.title;
      const filter = { title: title };
      const result = await commentCollection.find(filter).toArray();
      res.send(result);
    });

    // get specific posts comment data by id
    app.get("/getComments/:postId", async (req, res) => {
      const postId = req.params.postId;
      const filter = { postId: postId };
      const result = await commentCollection.find(filter).toArray();
      res.send(result);
    });

    // get specific post data
    app.get(`/post/:id`, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await postCollection.findOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("hey there");
});

app.listen(port, () => {
  console.log(`SocialPod is waiting at: ${port} `);
});
