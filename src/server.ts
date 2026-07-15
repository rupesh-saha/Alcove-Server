import 'dotenv/config';
import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb';

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

    app.get('/api/experiences/:slug', async (req: Request, res: Response) => {
      try {
        const { slug } = req.params;
        const experience = await experiencesCollection.findOne({ slug });

        if (!experience) {
          return res.status(404).send({ message: "Experience not found" });
        }

        res.status(200).json(experience);
      } catch (error) {
        console.error("Error fetching single experience:", error);
        res.status(500).json({ message: "Failed to fetch experience details" });
      }
    });

    app.get('/api/manage/experiences', async (req: Request, res: Response) => {
      try {
        const hostId = req.query.hostId as string;
        
        if (!hostId) {
           return res.status(401).json({ message: "Unauthorized: Missing host ID" });
        }

        const status = req.query.status as string; 
        const matchQuery: any = { host_id: hostId };
        
        if (status && status !== 'all') {
          matchQuery.status = status;
        }

        const results = await experiencesCollection.aggregate([
          { $match: matchQuery },
          {
            $lookup: {
              from: 'bookings',
              localField: '_id',
              foreignField: 'experience_id', 
              as: 'bookingList'
            }
          },
          {
            $addFields: {
              bookingCount: { $size: "$bookingList" }
            }
          },
          {
            $project: {
              bookingList: 0 
            }
          }
        ]).toArray();

        res.status(200).json(results);
      } catch (error) {
        console.error("Error fetching manage view:", error);
        res.status(500).json({ message: "Error fetching manage view" });
      }
    });

    app.delete('/api/experiences/:id', async (req: Request, res: Response) => {
      try {
        const id = req.params.id as string;
        const hostId = req.query.hostId as string; 

        const result = await experiencesCollection.deleteOne({ 
          _id: new ObjectId(id), 
          host_id: hostId 
        });

        if (result.deletedCount === 0) return res.status(404).send("Not found");
        res.status(200).send("Deleted");
      } catch (error) {
        res.status(500).send("Error deleting experience");
      }
    });

    app.patch('/api/experiences/:id', async (req: Request, res: Response) => {
      try {
        const id = req.params.id as string; 
        const updates = req.body; 

        await experiencesCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updates }
        );
        res.status(200).send("Updated");
      } catch (error) {
        res.status(500).send("Error updating experience");
      }
    });

    app.post('/api/experiences', async (req: Request, res: Response) => {
      try {
        const experienceData = req.body;
        const slug = experienceData.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');

        const newExperience = {
          ...experienceData,
          slug,
          status: 'draft', 
          createdAt: new Date(),
          avgRating: 0,
          reviewCount: 0,

          images: Array.isArray(experienceData.images) ? experienceData.images : experienceData.images.split(','),
          whatsIncluded: Array.isArray(experienceData.whatsIncluded) ? experienceData.whatsIncluded : experienceData.whatsIncluded.split(','),
          price: Number(experienceData.price),
          groupSizeMax: Number(experienceData.groupSizeMax)
        };

        const result = await experiencesCollection.insertOne(newExperience);
        res.status(201).json({ success: true, id: result.insertedId });
      } catch (error) {
        console.error("Error creating experience:", error);
        res.status(500).json({ message: "Failed to create experience" });
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