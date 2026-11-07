
import Joi from 'joi';
import bcrypt from 'bcryptjs';
import { Instructor } from '../models/Instructor.js';

// ======================================
// INPUT VALIDATION
// ======================================

const loginSchema = Joi.object({
  username: Joi.string().trim().min(1).max(100).required(),
  password: Joi.string().min(1).max(128).required()
}).unknown(false);

const searchSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100),
  department: Joi.string().trim().min(1).max(100),
  role: Joi.string().valid('instructor', 'superadmin')
}).min(1).unknown(false);


// ======================================
// PUBLIC PROFILE
// ======================================

function publicProfile(doc) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    username: doc.username,
    department: doc.department,
    role: doc.role
  };
}


// ======================================
// POST /api/instructors/login
// ======================================

export async function loginInstructor(req, res, next) {
  try {

    // Validate the incoming body
    const { error, value } = loginSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        message: 'Invalid input'
      });
    }

    const { username, password } = value;

    // Find the instructor using username only.
    // Explicitly select the password because select:false
    // hides it by default.
    const instructor = await Instructor.findOne({ username })
      .select('+password');

    // Reject nonexistent users
    if (!instructor) {
      return res.status(401).json({
        message: 'Invalid credentials'
      });
    }

    // Compare the supplied password with the stored hash
    const passwordMatches = await bcrypt.compare(
      password,
      instructor.password
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: 'Invalid credentials'
      });
    }

    // Return only public information
    return res.json({
      instructor: publicProfile(instructor)
    });

  } catch (err) {
    next(err);
  }
}


// ======================================
// GET /api/instructors
// ======================================

export async function getDirectory(req, res, next) {
  try {

    const instructors = await Instructor.find()
      .select('name department role')
      .sort({ name: 1 })
      .lean();

    res.json({ instructors });

  } catch (err) {
    next(err);
  }
}


// ======================================
// GET /api/instructors/search
// ======================================

export async function searchInstructors(req, res, next) {
  try {

    // Validate search parameters
    const { error, value } = searchSchema.validate(req.query);

    if (error) {
      return res.status(400).json({
        message: 'Invalid search parameters'
      });
    }

    // Build our own filter.
    // Never pass req.query directly into MongoDB.

    const filter = {};

    if (value.name) {
      const safeName = value.name.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
      );

      filter.name = {
        $regex: safeName,
        $options: 'i'
      };
    }

    if (value.department) {
      const safeDepartment = value.department.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
      );

      filter.department = {
        $regex: safeDepartment,
        $options: 'i'
      };
    }

    if (value.role) {
      filter.role = value.role;
    }

    // Return only public fields
    const instructors = await Instructor.find(filter)
      .select('name department role')
      .sort({ name: 1 })
      .lean();

    res.json({
      count: instructors.length,
      instructors
    });

  } catch (err) {
    next(err);
  }
}
