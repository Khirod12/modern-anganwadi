Inrequire("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const Program = require("./models/Program");

const app = express();

// =======================
// Middlewares
// =======================
app.use(express.json());
app.use(cors());

// =======================
// MongoDB Connection
// =======================
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("MongoDB Connected ✅"))
.catch(err => console.log("Mongo Error:", err));

// =======================
// Cloudinary Config
// =======================
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

// =======================
// Multer Setup
// =======================
const storage = multer.memoryStorage();
const upload = multer({ storage });

// =======================
// Admin Middleware
// =======================
function checkAdmin(req, res, next) {
  const adminKey = req.headers.adminkey;

  if (adminKey && adminKey === process.env.ADMIN_PASS) {
    next();
  } else {
    return res.status(403).json({ error: "Unauthorized ❌" });
  }
}

// =======================
// Root Route (Important for Render)
// =======================
app.get("/", (req, res) => {
  res.send("Modern Anganwadi Backend Running 🚀");
});

// =======================
// Admin Login
// =======================
app.post("/admin-login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and Password required ❌"
    });
  }

  if (!email.endsWith("@gmail.com")) {
    return res.status(400).json({
      success: false,
      message: "Only Gmail accounts allowed ❌"
    });
  }

  if (
    email === process.env.ADMIN_EMAIL &&
    password === process.env.ADMIN_PASS
  ) {
    return res.json({
      success: true,
      adminKey: process.env.ADMIN_PASS
    });
  }

  return res.status(401).json({
    success: false,
    message: "Invalid email or password ❌"
  });
});

// =======================
// Add Program
// =======================
app.post("/add-program", checkAdmin, upload.single("image"), async (req, res) => {
  try {
    const { title, description, date, time } = req.body;

    let imageUrl = "";

    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "anganwadi-programs" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });

      imageUrl = uploadResult.secure_url;
    }

    const newProgram = new Program({
      title,
      description,
      date,
      time,
      image: imageUrl
    });

    await newProgram.save();

    res.status(201).json({ message: "Program Added Successfully 💛" });

  } catch (error) {
    console.error("Add Error:", error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// =======================
// Update Program
// =======================
app.put("/update-program/:id", checkAdmin, upload.single("image"), async (req, res) => {
  try {
    const program = await Program.findById(req.params.id);
    if (!program) return res.status(404).json({ error: "Program not found" });

    let imageUrl = program.image;

    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "anganwadi-programs" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });

      imageUrl = uploadResult.secure_url;
    }

    program.title = req.body.title;
    program.description = req.body.description;
    program.date = req.body.date;
    program.time = req.body.time;
    program.image = imageUrl;

    await program.save();

    res.json({ message: "Program Updated Successfully ✅" });

  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ error: "Update failed" });
  }
});

// =======================
// Get Programs
// =======================
app.get("/programs", async (req, res) => {
  try {
    const programs = await Program.find().sort({ createdAt: -1 });
    res.json(programs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch programs" });
  }
});

// =======================
// Delete Program
// =======================
app.delete("/delete-program/:id", checkAdmin, async (req, res) => {
  try {
    const program = await Program.findById(req.params.id);
    if (!program) return res.status(404).json({ error: "Program not found" });

    if (program.image) {
      const publicId = program.image.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy("anganwadi-programs/" + publicId);
    }

    await Program.findByIdAndDelete(req.params.id);

    res.json({ message: "Program Deleted Successfully ✅" });

  } catch (error) {
    res.status(500).json({ error: "Delete failed" });
  }
});

// =======================
// Dashboard Stats
// =======================
app.get("/dashboard-stats", checkAdmin, async (req, res) => {
  try {
    const totalPrograms = await Program.countDocuments();
    const lastProgram = await Program.findOne().sort({ createdAt: -1 });

    res.json({
      totalPrograms,
      thisMonthCount: 0,
      lastAdded: lastProgram ? lastProgram.date : "N/A"
    });

  } catch (error) {
    res.status(500).json({ error: "Failed to load stats" });
  }
});

// =======================
// Serve Frontend
// =======================
app.use(express.static("public"));

// =======================
// START SERVER (Render Compatible)
// =======================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} 🚀`);
});
