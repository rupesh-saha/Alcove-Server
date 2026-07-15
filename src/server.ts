import 'dotenv/config';
import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import { MongoClient, ServerApiVersion } from 'mongodb';

const app: Express = express();
const port = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

const uri = process.env.ALCOVE_DB_URL as string;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const database = client.db('alcovedb');

    // collections — we'll wire up routes for these one at a time
    const experiencesCollection = database.collection('experiences');
    const bookingsCollection = database.collection('bookings');
    const paymentsCollection = database.collection('payments');
    const reviewsCollection = database.collection('reviews');

    await client.db('admin').command({ ping: 1 });
    console.log('Connected to MongoDB!');

    // routes will go here, added incrementally
  } finally {
    // client intentionally stays open for the server's lifetime
  }
}
run().catch(console.dir);

app.get('/', (req: Request, res: Response) => {
  res.send('Alcove server is running!');
});

app.listen(port, () => {
  console.log(`Alcove server listening on port ${port}`);
});