require("dotenv").config();
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
mongoose.connect(process.env.MONGO_URI)
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
// Admin Login (Gmail Validation)
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
// Add Program (Protected)
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
// Update Program (Protected)
// =======================
app.put("/update-program/:id", checkAdmin, upload.single("image"), async (req, res) => {
  try {
    const { title, description, date, time } = req.body;

    const program = await Program.findById(req.params.id);
    if (!program) {
      return res.status(404).json({ error: "Program not found" });
    }

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

    program.title = title;
    program.description = description;
    program.date = date;
    program.time = time;
    program.image = imageUrl;

    await program.save();

    res.json({ message: "Program Updated Successfully ✅" });

  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ error: "Update failed" });
  }
});

// =======================
// Get All Programs (Public)
// =======================
app.get("/programs", async (req, res) => {
  try {
    const programs = await Program.find().sort({ createdAt: -1 });
    res.json(programs);
  } catch (error) {
    console.error("Fetch Error:", error);
    res.status(500).json({ error: "Failed to fetch programs" });
  }
});

// =======================
// Delete Program (Protected)
// =======================
app.delete("/delete-program/:id", checkAdmin, async (req, res) => {
  try {
    const program = await Program.findById(req.params.id);

    if (!program) {
      return res.status(404).json({ error: "Program not found" });
    }

    if (program.image) {
      const publicId = program.image.split("/").pop().split(".")[0];
      await cloudinary.uploader.destroy("anganwadi-programs/" + publicId);
    }

    await Program.findByIdAndDelete(req.params.id);

    res.json({ message: "Program Deleted Successfully ✅" });

  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({ error: "Delete failed" });
  }
});
// =======================
// Dashboard Stats (Protected)
// =======================
app.get("/dashboard-stats", checkAdmin, async (req, res) => {
  try {
    const totalPrograms = await Program.countDocuments();

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const monthlyPrograms = await Program.find();

    const thisMonthCount = monthlyPrograms.filter(p => {
      const date = new Date(p.date);
      return (
        date.getMonth() === currentMonth &&
        date.getFullYear() === currentYear
      );
    }).length;

    const lastProgram = await Program.findOne().sort({ createdAt: -1 });

    res.json({
      totalPrograms,
      thisMonthCount,
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
// Start Server
// =======================
app.listen(5000, () => {
  console.log("Server started on http://localhost:5000 🚀");
});