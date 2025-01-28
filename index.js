const express = require("express");
const cors = require("cors");
const app = express();
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
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
    // await client.connect();

    const userCollection = client.db("socialPod").collection("users");
    const postCollection = client.db("socialPod").collection("posts");
    const tagCollection = client.db("socialPod").collection("tags");
    const commentCollection = client.db("socialPod").collection("comments");
    const announcementCollection = client
      .db("socialPod")
      .collection("announcements");

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_SECRET_TOKEN, {
        expiresIn: "10h",
      });
      res.send({ token });
    });

    // middleware verify the token
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];

      jwt.verify(token, process.env.ACCESS_SECRET_TOKEN, (error, decoded) => {
        if (error) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // middleware verify the admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // set user to database
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exiests" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // set user role
    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await userCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    // check user admin or not?
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    // get users from database
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const { search } = req.query;
      let query = {};
      if (search) {
        query = { name: { $regex: search, $options: "i" } };
      }
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    // post announcement
    app.post("/announcement", verifyToken, verifyAdmin, async (req, res) => {
      const data = req.body;
      const result = await announcementCollection.insertOne(data);
      res.send(result);
    });

    // get announcement
    app.get("/getAnnouncements", async (req, res) => {
      const result = await announcementCollection.find().toArray();
      res.send(result);
    });

    // post tags
    app.post("/tags", verifyToken, verifyAdmin, async (req, res) => {
      const data = req.body;
      const result = await tagCollection.insertOne(data);
      res.send(result);
    });

    // get tags
    app.get("/tags", async (req, res) => {
      const result = await tagCollection.find().toArray();
      res.send(result);
    });

    // stats or analytics
    app.get("/admin-stats", verifyToken, verifyAdmin, async (req, res) => {
      const users = await userCollection.estimatedDocumentCount();
      const posts = await postCollection.estimatedDocumentCount();
      const comments = await commentCollection.estimatedDocumentCount();
      res.send({
        users,
        posts,
        comments,
      });
    });

    // data related apis
    // post a new data
    app.post("/newPost", async (req, res) => {
      const postData = req.body;
      const result = await postCollection.insertOne(postData);
      res.send(result);
    });

    // get all posts data
    app.get("/post", async (req, res) => {
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      // console.log("pagination query", page, size);
      // const { search } = req.query;
      // let query = {};
      // if (search) {
      //   query = { tags: { $regex: search, $options: "i" } };
      // }
      const result = await postCollection
        .find()
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });

    // get posts count
    app.get("/postCount", async (req, res) => {
      const count = await postCollection.estimatedDocumentCount();
      res.send({
        count,
      });
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

    // get all comments
    app.get("/comments", async (req, res) => {
      const result = await commentCollection.find().toArray();
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

    // payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // after successfully payment the badge will updated
    app.post("/payment-success", verifyToken, async (req, res) => {
      const { email } = req.body;
      const filter = { email: email };
      const updateDoc = {
        $set: { badge: "Gold" },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // get user badge
    app.get("/user/badge/:email",verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const result = await userCollection.findOne(query, {
        projection: { badge: 1, _id: 0 },
      });
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
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
