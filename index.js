const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 5000;
require('dotenv').config();
const moment = require('moment');
const rateLimit = require('express-rate-limit');

app.use(cors({ origin: '*' }));
app.use(express.json());

const limiter = rateLimit({
    windowMs: 2 * 60 * 1000, // 2 minutes
    max: 100, // limit each IP to 50 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
});

app.use(limiter);


// console.log(moment().format('YYYY-MM-DD HH:mm'));

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tjhl6td.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        client.connect();

        const usersCollection = client.db("fisLunchManager").collection("users");
        const lunchesCollection = client.db("fisLunchManager").collection("lunches");
        // const usersCollection = client.db("devFIS_Manager").collection("users");
        // const lunchesCollection = client.db("devFIS_Manager").collection("lunches");
        // const itemsCollection = client.db("devFIS_Manager").collection("items");


        // get single / current day lunch data
        app.get('/lunch', async (req, res) => {

            const dateToday = new Date().toLocaleDateString(); //get date only
            console.log(dateToday);
            const query = { date: dateToday };
            const result = await lunchesCollection.findOne(query);
            res.send(result)

        })

        // get month based lunch data 
        app.get('/monthly', async (req, res) => {
            const date = req.query.date;

            // const [month, year] = selectedMonth.split('/');
            // const parsedMonth = parseInt(month, 10);
            // const parsedYear = parseInt(year, 10);


            const query = {
                date2: date,
            };
            console.log('query', query);
            const result = await lunchesCollection.find(query).toArray();
            console.log(result);
            res.send(result);

        });



        app.post('/lunch', async (req, res) => {
            const lunch = req.body;

            const formattedDate = new Date().toLocaleDateString(); //get date only
            const monthYearDate = `${new Date().getMonth() + 1}/${new Date().getFullYear()}`;


            // Check document with today's date
            const query = { date: formattedDate };
            const existing = await lunchesCollection.findOne(query);

            if (!existing) {

                const result = await lunchesCollection.insertOne({ date: formattedDate, date2: monthYearDate, data: [lunch] });

                return res.send(result);
            }

            const emailExists = existing.data.some(item => item.email === lunch.email);
            const guestExists = existing.data.some(item => item.email === 'guest@gmail.com');


            if (!emailExists) {
                // Add new lunch for the guest if they don't exist
                const result = await lunchesCollection.updateOne(
                    { date: formattedDate },
                    { $push: { data: lunch } }
                );
                return res.send(result);
            }

            if (guestExists && lunch.email === 'guest@gmail.com') {
                const result = await lunchesCollection.updateOne(
                    { date: formattedDate, 'data.email': 'guest@gmail.com' },
                    {
                        $set: {
                            'data.$.name': lunch.name,
                            'data.$.note': lunch.note,
                            'data.$.lunchQuantity': lunch.lunchQuantity,
                            'data.$.modifiedCount': (existing.data.find(item => item.email === 'guest@gmail.com')?.modifiedCount || 0) + 1
                        }
                    }
                );
                return res.send(result);
            }

            // If the email already exists
            res.send({ message: 'already exist', insertedId: null });
        });



        // post api to save users in DB
        app.post('/users', async (req, res) => {

            const user = req.body;

            const query = { email: req.body.email }
            const existing = await usersCollection.findOne(query);
            if (existing) {
                return res.send({ message: 'already user', insertedId: null })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);

        })

        app.patch('/userapprove/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updatedUser = {
                $set: {
                    status: 'approve'
                }
            }
            const result = await usersCollection.updateOne(query, updatedUser);
            res.send(result);

        })

        app.patch('/users/:id', async (req, res) => {
            const id = req.params.id;
            const users = req.body;
            console.log(users)
            const query = { _id: new ObjectId(id) }
            const options = { upsert: true }

            const updatedUser = {
                $set: {
                    managerName: users.managerName,
                    orgType: users.orgType,
                    orgName: users.orgName,
                    contactNumber: users.contactNumber,
                    username: users.username,
                    map: users.map,
                    website: users.website,
                    location: users.location,
                    date: new Date().toLocaleString(),
                }
            }
            const result = await usersCollection.updateOne(query, updatedUser, options);
            console.log(result);
            res.send(result);

        })

        app.patch('/usertoadmin/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updatedUser = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(query, updatedUser);
            res.send(result);

        })

        // delete api 
        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = {
                _id: new ObjectId(id)
            }
            const result = await usersCollection.deleteOne(query)
            res.send(result);
        })


        // get api to get users from DB 
        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result)

        })

        app.post('/items', async (req, res) => {
            const item = req.body;
            const result = await itemsCollection.insertOne(item);
            res.send(result);

        })
        app.get('/items', async (req, res) => {
            const result = await itemsCollection.find().toArray();
            res.send(result)

        })



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("FIS Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('FIS Lunch Manage server online!');
});

// Start the server
app.listen(port, () => {
    console.log(`FIS Lunch Manage Server is running on port ${port}`);
    console.log(`waiting for MongoDB ping..`);
});