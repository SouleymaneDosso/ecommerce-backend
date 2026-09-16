const Visite = require("../models/visiteModel");

const enregistrerVisite = async (req, res) => {
  try {
    const {
      visitorId,
      sessionId,
      page,
    } = req.body;

    if (!visitorId || !sessionId || !page) {
      return res.status(400).json({
        message: "visitorId, sessionId et page sont requis",
      });
    }

    const visite = await Visite.create({
      visitorId,
      sessionId,
      page,
      userId: req.auth?.userId || null,
    });

    res.status(201).json({
      message: "Visite enregistrée",
      visiteId: visite._id,
    });
  } catch (error) {
    console.error("❌ Erreur enregistrement visite :", error);

    res.status(500).json({
      message: "Erreur lors de l'enregistrement de la visite",
    });
  }
};

module.exports = {
  enregistrerVisite,
};