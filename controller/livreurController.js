const Livreur = require("../models/livreur");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// ===============================
// INSCRIPTION LIVREUR
// ===============================
exports.signup = async (req, res) => {
  try {
    const { username, email, password, telephone } = req.body;

    if (!username || !email || !password || !telephone) {
      return res.status(400).json({
        message: "Tous les champs sont requis",
      });
    }

    const existingLivreur = await Livreur.findOne({
      $or: [{ username }, { email }],
    });

    if (existingLivreur) {
      return res.status(400).json({
        message: "Ce livreur existe déjà",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const livreur = await Livreur.create({
      username,
      email,
      password: hashedPassword,
      telephone,
    });

    const token = jwt.sign(
      { userId: livreur._id },
      process.env.JWT_SECRET_LIVREUR,
      { expiresIn: "7d" },
    );

    res.status(201).json({
      message: "Compte livreur créé",
      livreurId: livreur._id,
      username: livreur.username,
      token,
    });
  } catch (error) {
    console.error("Livreur signup error:", error);

    res.status(500).json({
      message: "Erreur serveur",
    });
  }
};



// ===============================
// CONNEXION LIVREUR
// ===============================
exports.login = async (req, res) => {
  try {
    // Récupérer les données envoyées par le frontend
    const { username, password } = req.body;

    // Vérifier que les deux champs existent
    if (!username || !password) {
      return res.status(400).json({
        message: "Identifiant et mot de passe requis",
      });
    }

    // Chercher le livreur avec son username
    const livreur = await Livreur.findOne({ username });

    // Aucun livreur trouvé
    if (!livreur) {
      return res.status(401).json({
        message: "Identifiant ou mot de passe incorrect",
      });
    }

    // Vérifier si le compte est actif
    if (!livreur.actif) {
      return res.status(403).json({
        message: "Compte livreur désactivé",
      });
    }

    // Comparer le mot de passe avec le hash enregistré
    const passwordCorrect = await livreur.comparePassword(password);

    // Mauvais mot de passe
    if (!passwordCorrect) {
      return res.status(401).json({
        message: "Identifiant ou mot de passe incorrect",
      });
    }

    // Créer le token JWT
    const token = jwt.sign(
      {
        userId: livreur._id,
      },
      process.env.JWT_SECRET_LIVREUR,
      {
        expiresIn: "7d",
      },
    );

    // Envoyer les informations au frontend
    return res.status(200).json({
      message: "Connexion réussie",
      token,
      livreur: {
        id: livreur._id,
        username: livreur.username,
        email: livreur.email,
        telephone: livreur.telephone,
        actif: livreur.actif,
        statut: livreur.statut,
        localisation: livreur.localisation,
        commandeActuelle: livreur.commandeActuelle,
      },
    });
  } catch (error) {
    console.error("Livreur login error:", error);

    return res.status(500).json({
      message: "Erreur serveur",
    });
  }
};
