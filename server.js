const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const mongoUri =
  process.env.MONGODB_URI ||
  "mongodb://127.0.0.1:27017/mongodb_local";

app.use(cors());
app.use(express.json());

// Serve frontend files from the project folder
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Assignment Schema
const assignmentSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      sparse: true,
    },
    title: { type: String, required: true, trim: true },
    subject: { type: String, default: "" },
    description: { type: String, default: "" },
    deadline: { type: String, default: "" },
    maxScore: { type: Number, default: 10 },
    priority: { type: String, default: "Medium" },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

assignmentSchema.pre("validate", function () {
  if (!this.id) {
    this.id = `A${Date.now()}${Math.floor(Math.random() * 1000)}`;
  }
});

const Assignment = mongoose.model("Assignment", assignmentSchema);

// User Schema
const userSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["student", "faculty"],
      required: true,
      index: true,
    },
    name: { type: String, default: "" },
    regNo: { type: String, default: "", index: true, sparse: true },
    email: { type: String, default: "", index: true, sparse: true },
    password: { type: String, required: true },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

// Submission Schema
const submissionSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      sparse: true,
    },
    assignmentId: { type: String, required: true, index: true },
    assignmentTitle: { type: String, default: "" },
    studentName: { type: String, default: "" },
    regNo: { type: String, required: true, index: true },
    fileName: { type: String, default: "" },
    submittedAt: { type: String, default: "" },
    score: { type: String, default: "" },
    feedback: { type: String, default: "" },
    hoursSpent: { type: String, default: "" },
    note: { type: String, default: "" },
    isOwnWork: { type: Boolean, default: false },
    maxScore: { type: Number, default: 10 },
    onTime: { type: Boolean, default: true },
    lateDays: { type: Number, default: 0 },
  },
  { timestamps: true }
);

submissionSchema.index(
  { assignmentId: 1, regNo: 1 },
  { unique: true }
);

submissionSchema.pre("validate", function () {
  if (!this.id) {
    this.id = `S${Date.now()}${Math.floor(Math.random() * 1000)}`;
  }
});

const Submission = mongoose.model("Submission", submissionSchema);

// Seed default login credentials
async function seedDefaultUsers() {
  const defaultUsers = [
    {
      role: "student",
      name: "Demo Student",
      regNo: "123",
      password: "123",
    },
    {
      role: "faculty",
      name: "Demo Faculty",
      email: "faculty@lms.com",
      password: "123",
    },
  ];

  for (const row of defaultUsers) {
    const query =
      row.role === "student"
        ? { role: "student", regNo: row.regNo }
        : { role: "faculty", email: row.email };

    await User.updateOne(
      query,
      { $setOnInsert: row },
      { upsert: true }
    );
  }

  console.log("Default login credentials seeded once if missing.");
}

// Lookup helpers
function assignmentLookupQuery(assignmentId) {
  if (mongoose.Types.ObjectId.isValid(assignmentId)) {
    return {
      $or: [
        { id: assignmentId },
        { _id: assignmentId },
      ],
    };
  }

  return { id: assignmentId };
}

function submissionLookupQuery(submissionId) {
  if (mongoose.Types.ObjectId.isValid(submissionId)) {
    return {
      $or: [
        { id: submissionId },
        { _id: submissionId },
      ],
    };
  }

  return { id: submissionId };
}

// Health Check
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    mongodb:
      mongoose.connection.readyState === 1
        ? "connected"
        : "disconnected",
    database: mongoose.connection?.name || "mongodb_local",
  });
});

// Get Assignments
app.get("/api/assignments", async (req, res) => {
  try {
    const assignments = await Assignment.find().sort({
      createdAt: -1,
    });

    const rows = assignments.map((item) => {
      const row = item.toObject();
      if (!row.id) row.id = String(row._id);
      return row;
    });

    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: "Failed to load assignments",
      error: error.message,
    });
  }
});

// Create Assignment
app.post("/api/assignments", async (req, res) => {
  try {
    const assignment = await Assignment.create(req.body);
    res.status(201).json(assignment);
  } catch (error) {
    res.status(400).json({
      message: "Failed to create assignment",
      error: error.message,
    });
  }
});

// Update Assignment
app.put("/api/assignments/:id", async (req, res) => {
  try {
    const assignment = await Assignment.findOneAndUpdate(
      assignmentLookupQuery(req.params.id),
      req.body,
      { new: true, runValidators: true }
    );

    if (!assignment) {
      return res.status(404).json({
        message: "Assignment not found",
      });
    }

    res.json(assignment);
  } catch (error) {
    res.status(400).json({
      message: "Failed to update assignment",
      error: error.message,
    });
  }
});

// Delete Assignment
app.delete("/api/assignments/:id", async (req, res) => {
  try {
    const assignment = await Assignment.findOneAndDelete(
      assignmentLookupQuery(req.params.id)
    );

    if (!assignment) {
      return res.status(404).json({
        message: "Assignment not found",
      });
    }

    await Submission.deleteMany({
      assignmentId: assignment.id || req.params.id,
    });

    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({
      message: "Failed to delete assignment",
      error: error.message,
    });
  }
});

// Get Submissions
app.get("/api/submissions", async (req, res) => {
  try {
    const submissions = await Submission.find().sort({
      submittedAt: -1,
      createdAt: -1,
    });

    const rows = submissions.map((item) => {
      const row = item.toObject();
      if (!row.id) row.id = String(row._id);
      return row;
    });

    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: "Failed to load submissions",
      error: error.message,
    });
  }
});

// Create or Update Submission
app.post("/api/submissions", async (req, res) => {
  try {
    const regNo = String(req.body?.regNo || "").trim();
    const assignmentId = String(
      req.body?.assignmentId || ""
    ).trim();

    if (!regNo || !assignmentId) {
      return res.status(400).json({
        message: "regNo and assignmentId are required",
      });
    }

    const existing = await Submission.findOne({
      regNo,
      assignmentId,
    }).lean();

    const stableId =
      existing?.id ||
      req.body?.id ||
      `S${Date.now()}${Math.floor(Math.random() * 1000)}`;

    const payload = {
      ...req.body,
      id: stableId,
      regNo,
      assignmentId,
    };

    const submission = await Submission.findOneAndUpdate(
      { regNo, assignmentId },
      payload,
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    );

    const row = submission.toObject();
    if (!row.id) row.id = String(row._id);

    res.status(201).json(row);
  } catch (error) {
    res.status(400).json({
      message: "Failed to save submission",
      error: error.message,
    });
  }
});

// Update Submission
app.put("/api/submissions/:id", async (req, res) => {
  try {
    const submission = await Submission.findOneAndUpdate(
      submissionLookupQuery(req.params.id),
      req.body,
      { new: true, runValidators: true }
    );

    if (!submission) {
      return res.status(404).json({
        message: "Submission not found",
      });
    }

    const row = submission.toObject();
    if (!row.id) row.id = String(row._id);

    res.json(row);
  } catch (error) {
    res.status(400).json({
      message: "Failed to update submission",
      error: error.message,
    });
  }
});

// Student Signup
app.post("/api/auth/student-signup", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const regNo = String(req.body?.regNo || "").trim();
    const password = String(req.body?.password || "").trim();

    if (!name || !regNo || !password) {
      return res.status(400).json({
        ok: false,
        message: "name, regNo and password are required",
      });
    }

    const exists = await User.findOne({
      role: "student",
      regNo,
    }).lean();

    if (exists) {
      return res.status(409).json({
        ok: false,
        message: "Student register number already exists",
      });
    }

    const user = await User.create({
      role: "student",
      name,
      regNo,
      password,
    });

    res.status(201).json({
      ok: true,
      user: {
        name: user.name,
        regNo: user.regNo,
      },
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Student signup failed",
      error: error.message,
    });
  }
});

// Faculty Signup
app.post("/api/auth/faculty-signup", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || "").trim();

    if (!name || !email || !password) {
      return res.status(400).json({
        ok: false,
        message: "name, email and password are required",
      });
    }

    const exists = await User.findOne({
      role: "faculty",
      email,
    }).lean();

    if (exists) {
      return res.status(409).json({
        ok: false,
        message: "Faculty email already exists",
      });
    }

    const user = await User.create({
      role: "faculty",
      name,
      email,
      password,
    });

    res.status(201).json({
      ok: true,
      user: {
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Faculty signup failed",
      error: error.message,
    });
  }
});

// Student Login
app.post("/api/auth/student-login", async (req, res) => {
  try {
    const regNo = String(req.body?.regNo || "").trim();
    const password = String(req.body?.password || "").trim();

    const user = await User.findOne({
      role: "student",
      regNo,
      password,
    }).lean();

    if (!user) {
      return res.status(401).json({
        ok: false,
        message: "Invalid student credentials",
      });
    }

    res.json({
      ok: true,
      user: {
        name: user.name || "Student",
        regNo: user.regNo,
      },
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Student login failed",
      error: error.message,
    });
  }
});

// Faculty Login
app.post("/api/auth/faculty-login", async (req, res) => {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || "").trim();

    const user = await User.findOne({
      role: "faculty",
      email,
      password,
    }).lean();

    if (!user) {
      return res.status(401).json({
        ok: false,
        message: "Invalid faculty credentials",
      });
    }

    res.json({
      ok: true,
      user: {
        name: user.name || "Faculty",
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Faculty login failed",
      error: error.message,
    });
  }
});

// Start Server
async function startServer() {
  try {
    await mongoose.connect(mongoUri);
    console.log(`MongoDB connected: ${mongoose.connection.name}`);

    await seedDefaultUsers();

    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error(
      "MongoDB connection failed:",
      error.message
    );
    process.exit(1);
  }
}

startServer();