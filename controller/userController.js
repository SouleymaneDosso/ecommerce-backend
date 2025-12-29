const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

// ===============================
// INSCRIPTION
// ===============================
exports.signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "Tous les champs sont requis" });
    }

    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) return res.status(400).json({ message: "Ce compte existe déjà" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({ username, email, password: hashedPassword });

    // Token JWT
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET_CLIENT, { expiresIn: "7d" });

    // ⚠️ Envoi en cookie sécurisé pour mobile
    res.cookie("token", token, {
      httpOnly: true,
      secure: true,      // HTTPS obligatoire
      sameSite: "none",  // Cross-domain mobile
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 jours
    });

    res.status(201).json({ message: "Utilisateur créé", userId: user._id, username: user.username , token: token });
  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ===============================
// CONNEXION
// ===============================
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) return res.status(400).json({ message: "Tous les champs sont requis" });

    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: "Utilisateur non trouvé" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Mot de passe incorrect" });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET_CLIENT, { expiresIn: "7d" });

    // ⚠️ Cookie sécurisé
    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(200).json({ userId: user._id, username: user.username , token: token  });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};
