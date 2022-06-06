const express = require("express");
const mongoose = require("mongoose");
const User = require("./models/User");
const Appointment = require("./models/Appointment");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const dbURI =
  "mongodb+srv://admin:admin@cluster0.fhkh1eu.mongodb.net/?retryWrites=true&w=majority";
const JWT_SECRET =
  "erhfcruifnhrencfirehfniruehfihf758yt847t59y(*^*&#ynr&#ry*q&r$yrn&*$ynr($&ry($*(*u(*u#R9*#NRU98";
app.use(express.json());

mongoose
  .connect(dbURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(3000, () => {
      console.log(`Server is running on port http://127.0.0.1:3000`);
    });
  })
  .catch((err) => console.log(err));

app.get("/", (req, res) => {
  return res.status(200).json({
    message: "Welcome to the Appointment Booking API",
  });
});

//? Authentication APIs(LOGIN SYSTEM)

// ✅
app.post("/api/auth/register", async (req, res) => {
  const { username, password: passwordPlain, acctype = "customer" } = req.body;
  if (!username || typeof username !== "string") {
    return res.status(400).json({
      message: "Invalid username",
    });
  }
  if (!passwordPlain || typeof passwordPlain !== "string") {
    return res.status(400).json({
      message: "Invalid password",
    });
  }
  if (passwordPlain.length < 8) {
    return res.status(400).json({
      message: "Password must be at least 8 characters long",
    });
  }
  if (passwordPlain != req.body.confirmPassword) {
    return res.status(400).json({
      message: "Passwords do not match",
    });
  }
  const password = await bcrypt.hash(passwordPlain, 10);
  try {
    const user = await User.create({
      username,
      password,
      userType: acctype,
    });
    return res.status(201).json({
      message: "User registered successfully",
      user,
    });
  } catch (err) {
    if (err.code == 11000) {
      return res.status(400).json({
        message: "Username already exists",
        error: err,
      });
    }
    return res.status(500).json({
      message: "Internal server error",
      error: err,
    });
  }
});

// ✅
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (
    !username ||
    typeof username !== "string" ||
    !password ||
    typeof password !== "string"
  )
    return res.status(400).json({
      message: "Invalid username/password",
    });
  const user = await User.findOne({ username }).lean();
  if (!user) {
    return res.status(400).json({
      message: "Invalid username/password",
    });
  }
  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    return res.status(400).json({
      message: "Invalid username/password",
    });
  }
  const token = jwt.sign(
    { id: user._id, username: user.username, userType: user.userType },
    JWT_SECRET
  );
  return res.status(200).json({
    token,
  });
});

// ✅
app.post("/api/auth/change-password", async (req, res) => {
  const { token } = req.headers;
  const { newPassword } = req.body;

  try {
    const user = jwt.verify(token, JWT_SECRET);
    if (newPassword.length < 8)
      return res.status(400).json({
        message: "Password too short 8 character minimum",
      });
    const newHashedPassword = await bcrypt.hash(newPassword, 10);
    await User.updateOne(
      { _id: user.id },
      {
        $set: { password: newHashedPassword },
      }
    );
    return res.status(200).json({
      message: "Password changed successfully",
    });
  } catch (err) {
    return res.status(401).json({
      message: "Invalid token",
      error: err,
    });
  }
});

//! DEBUG method
// app.get("/api/userlist", async (req, res) => {
//   return res.status(200).json({
//     message: "User list",
//     users: await User.find({}),
//   });
// });

//? Appointment APIs

//? View appointments(FOR BOTH CUSTOMERS AND BUSINESSES) ✅
app.get("/api/view-appointments", async (req, res) => {
  const { token } = req.headers;
  if (!token)
    return res.status(401).json({
      message: "Please login with valid credentials to view your appointments",
    });
  try {
    const user = jwt.verify(token, JWT_SECRET);
    let appointments;
    if (user.userType == "customer")
      appointments = await Appointment.find({ user: user.id });
    else appointments = await Appointment.find({});
    return res.status(200).json({
      appointments,
    });
  } catch (err) {
    return res.status(401).json({
      message: "Invalid token",
      error: err,
    });
  }
});

//? To book and appointment (FOR CUSTOMERS) ✅
app.post("/api/book-appointment", async (req, res) => {
  const { token } = req.headers;
  const { date, appointment_details, notes, status = "pending" } = req.body;
  if (!token)
    return res.status(401).json({
      message: "Please login with valid credentials to book an appointment",
    });
  try {
    const user = jwt.verify(token, JWT_SECRET);
    if (user.userType == "business")
      return res.status(401).json({
        message: "This endpoint is only for customers, please use business",
      });
    const appointment = await Appointment.create({
      user: user.id,
      date,
      appointment_details,
      notes,
      status,
    });
    return res.status(201).json({
      message: "Appointment booked successfully",
      appointment,
    });
  } catch (err) {
    return res.status(401).json({
      message:
        "Invalid token or Invalid date please check date range(only a week allowed to book for appointment)",
      error: err,
    });
  }
});

//? view appointment (FOR CUSTOMERS) ✅
app.get("/api/my-appointments", async (req, res) => {
  const { token } = req.headers;
  if (!token)
    return res.status(401).json({
      message: "Please login with valid credentials to view your appointments",
    });
  try {
    const user = jwt.verify(token, JWT_SECRET);
    let appointments;
    if (user.userType == "customer") {
      appointments = await Appointment.find({ user: user.id });
      return res.status(200).json({
        appointments,
      });
    } else {
      return res.status(401).json({
        message: "This endpoint is only for customers, please use business",
      });
    }
  } catch (err) {
    return res.status(401).json({
      message: "Invalid token",
    });
  }
});

//? update appointments (FOR CUSTOMERS)  ✅
app.put("/api/my-appointments", async (req, res) => {
  const { token } = req.headers;
  const { id, notes, date } = req.body;
  let updateObject = {};
  if (date) {
    updateObject.date = date;
    console.log(updateObject);
  }
  if (notes) {
    updateObject.notes = notes;
    console.log(updateObject);
  }
  console.log(updateObject);
  if (!token)
    return res.status(401).json({
      message: "Please login with valid credentials to update an appointment",
    });
  try {
    const user = jwt.verify(token, JWT_SECRET);
    if (user.userType == "business")
      return res.status(401).json({
        message:
          "This endpoint is only for customers, please use business endpoint",
      });
    await Appointment.updateOne(
      { _id: id },
      {
        $set: { ...updateObject },
      }
    );
    return res.status(200).json({
      message: "Appointment updated successfully",
    });
  } catch (err) {
    return res.status(401).json({
      message: "Invalid token",
    });
  }
});

//? update customer appointments by id (FOR BUSINESSES) ✅
app.put("/api/update-appointment", async (req, res) => {
  const { token } = req.headers;
  const { id, status } = req.body;
  if (!token)
    return res.status(401).json({
      message: "Please login with valid credentials to update an appointment",
    });
  try {
    const user = jwt.verify(token, JWT_SECRET);
    if (user.userType == "customer")
      return res.status(401).json({
        message: "Not allowed",
      });
    await Appointment.updateOne(
      { _id: id },
      {
        $set: { status },
      }
    );
    return res.status(200).json({
      message: "Appointment updated successfully",
    });
  } catch (err) {
    return res.status(401).json({
      message: "Invalid token",
    });
  }
});
