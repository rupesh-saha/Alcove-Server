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

    app.get('/api/experiences', async (req: Request, res: Response) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 9;
        const search = (req.query.search as string) || "";
        const category = (req.query.category as string) || "all";

        const query: any = { status: 'active' };

        if (search) {
          query.title = { $regex: search, $options: 'i' };
        }

        if (category && category !== "all") {
          query.category = category;
        }

        const skip = (page - 1) * limit;

        const [totalExperiences, experiences] = await Promise.all([
          experiencesCollection.countDocuments(query),
          experiencesCollection.find(query).skip(skip).limit(limit).toArray()
        ]);

        const totalPages = Math.ceil(totalExperiences / limit);
        res.status(200).json({
          data: experiences,
          totalPages,
          currentPage: page,
          totalCount: totalExperiences
        });
      } catch (error) {
        console.error("Error fetching experiences:", error);
        res.status(500).json({ message: "Failed to fetch experiences" });
      }
    });

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