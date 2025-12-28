const User = require("../models/User");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

// ===============================
// INSCRIPTION
// ===============================
exports.signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Vérification des champs
    if (!username || !email || !password) {
      return res.status(400).json({ message: "Tous les champs sont requis" });
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({ message: "Ce compte existe déjà" });
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Créer l'utilisateur
    const user = new User({
      username,
      email,
      password: hashedPassword,
    });

    await user.save();

    // Générer le token immédiatement
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET_CLIENT,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Utilisateur créé avec succès",
      token,
      userId: user._id,
      username: user.username,
    });
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

    if (!username || !password) {
      return res.status(400).json({ message: "Tous les champs sont requis" });
    }

    // Vérifier que l'utilisateur existe
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: "Utilisateur non trouvé" });
    }

    // Comparer le mot de passe
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Mot de passe incorrect" });
    }

    // Générer le token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET_CLIENT,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      token,
      userId: user._id,
      username: user.username,
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};
