const argon2 = require("argon2");
const jwt = require("jsonwebtoken");

const {
  ADMIN_OPERATION_PASSWORD_HASH,
  ADMIN_PASSWORD_HASH,
  ADMIN_USERNAME,
} = require("../config/adminCredentials");

const ADMIN_JWT_SECRET = (process.env.ADMIN_JWT_SECRET || "exam-results-portal-admin-secret").trim();
const ADMIN_JWT_EXPIRES_IN = "8h";
const ADMIN_OPERATION_JWT_EXPIRES_IN = "2h";

function getBearerToken(req) {
  const authorizationHeader = String(req.get("authorization") || "").trim();
  const [scheme, token] = authorizationHeader.split(/\s+/);

  if (scheme !== "Bearer" || !token) {
    return "";
  }

  return token;
}

function getOperationPassword(req) {
  return String(req.get("x-operation-password") || req.body?.password || "").trim();
}

function requireAdminAuth(req, res, next) {
  const token = getBearerToken(req);

  if (!token) {
    return res.status(401).json({ message: "Admin authentication is required." });
  }

  try {
    req.admin = jwt.verify(token, ADMIN_JWT_SECRET);
    return next();
  } catch (_error) {
    return res.status(401).json({ message: "Admin session expired. Please log in again." });
  }
}

function requireAdminOperationAuth(req, res, next) {
  const token = getBearerToken(req);

  if (!token) {
    return res.status(401).json({ message: "Operation password is required." });
  }

  try {
    const payload = jwt.verify(token, ADMIN_JWT_SECRET);

    if (payload.scope !== "admin-operation") {
      return res.status(401).json({ message: "Operation password is required." });
    }

    req.adminOperation = payload;
    return next();
  } catch (_error) {
    return res.status(401).json({ message: "Operation session expired. Please enter the password again." });
  }
}

async function requireAdminOperationPassword(req, res, next) {
  try {
    const password = getOperationPassword(req);

    if (!password) {
      return res.status(401).json({ message: "Operation password is required." });
    }

    const isPasswordValid = await argon2.verify(ADMIN_OPERATION_PASSWORD_HASH, password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid operation password." });
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

async function loginAdmin(req, res, next) {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");

    if (username !== ADMIN_USERNAME) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    const isPasswordValid = await argon2.verify(ADMIN_PASSWORD_HASH, password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    const token = jwt.sign({ username: ADMIN_USERNAME }, ADMIN_JWT_SECRET, {
      expiresIn: ADMIN_JWT_EXPIRES_IN,
    });

    return res.status(200).json({
      message: "Admin login successful.",
      token,
      admin: {
        username: ADMIN_USERNAME,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function loginAdminOperation(req, res, next) {
  try {
    const username = String(req.body.username || ADMIN_USERNAME).trim();
    const password = String(req.body.password || "");

    if (username !== ADMIN_USERNAME) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    const isPasswordValid = await argon2.verify(ADMIN_OPERATION_PASSWORD_HASH, password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid password." });
    }

    const token = jwt.sign(
      { username: ADMIN_USERNAME, scope: "admin-operation" },
      ADMIN_JWT_SECRET,
      { expiresIn: ADMIN_OPERATION_JWT_EXPIRES_IN },
    );

    return res.status(200).json({
      message: "Operation password accepted.",
      token,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  requireAdminOperationPassword,
  loginAdminOperation,
  loginAdmin,
  requireAdminOperationAuth,
  requireAdminAuth,
};