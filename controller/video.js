const cloudinary = require("../config/cloudinary");
const Video = require("../models/video");
const Produits = require("../models/produits");
const streamifier = require("streamifier");

/* =====================================================
   UPLOAD VIDÉOS SOUS-HERO
   SYSTÈME EXISTANT — ON NE TOUCHE PAS
===================================================== */

exports.uploadervideo = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        message: "Aucune vidéo disponible actuellement.",
      });
    }

    const uploaderPromises = req.files.map((file) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "numa/video",
            resource_type: "video",
          },
          (error, result) => {
            if (error) {
              return reject(error);
            }

            resolve({
              result,
              file,
            });
          }
        );

        streamifier.createReadStream(file.buffer).pipe(stream);
      });
    });

    const results = await Promise.all(uploaderPromises);

    const nouvellesVideos = results.map(({ result, file }) => ({
      title: file.originalname,
      description: req.body.description || "",
      url: result.secure_url,
      public_id: result.public_id,
      thumbnail: cloudinary.url(result.public_id, {
        resource_type: "video",
        format: "jpg",
      }),
      produitId: null,
    }));

    const videos = await Video.insertMany(nouvellesVideos);

    return res.status(201).json({
      message: "Vidéos uploadées avec succès.",
      videos,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Erreur lors de l'upload des vidéos.",
      error: error.message,
    });
  }
};


/* =====================================================
   UPLOAD VIDÉO POUR UN PRODUIT
===================================================== */

exports.uploadVideoProduit = async (req, res) => {
  try {
    const { produitId } = req.body;

    if (!produitId) {
      return res.status(400).json({
        message: "produitId est requis.",
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        message: "Aucune vidéo reçue.",
      });
    }

    // On autorise une seule vidéo par produit
    const file = req.files[0];

    const produit = await Produits.findById(produitId);

    if (!produit) {
      return res.status(404).json({
        message: "Produit introuvable.",
      });
    }

    /*
      Si le produit possède déjà une vidéo,
      on supprime l'ancienne de Cloudinary + MongoDB.
    */
    if (produit.videoId) {
      const ancienneVideo = await Video.findById(produit.videoId);

      if (ancienneVideo) {
        try {
          await cloudinary.uploader.destroy(ancienneVideo.public_id, {
            resource_type: "video",
          });
        } catch (cloudinaryError) {
          console.error(
            "Erreur suppression ancienne vidéo Cloudinary:",
            cloudinaryError.message
          );
        }

        await Video.findByIdAndDelete(ancienneVideo._id);
      }

      produit.videoId = null;
    }

    // Upload Cloudinary
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "numa/video/produits",
          resource_type: "video",
        },
        (error, result) => {
          if (error) {
            return reject(error);
          }

          resolve(result);
        }
      );

      streamifier.createReadStream(file.buffer).pipe(stream);
    });

    // Création vidéo
    const video = await Video.create({
      title: req.body.title || produit.title,
      description: req.body.description || "",
      url: result.secure_url,
      public_id: result.public_id,
      thumbnail: cloudinary.url(result.public_id, {
        resource_type: "video",
        format: "jpg",
      }),
      produitId: produit._id,
    });

    // Association au produit
    produit.videoId = video._id;
    await produit.save();

    return res.status(201).json({
      message: "Vidéo associée au produit avec succès.",
      video,
      produit: {
        _id: produit._id,
        title: produit.title,
        videoId: produit.videoId,
      },
    });
  } catch (error) {
    console.error("❌ uploadVideoProduit:", error);

    return res.status(500).json({
      message: "Erreur lors de l'upload de la vidéo du produit.",
      error: error.message,
    });
  }
};


/* =====================================================
   GET TOUTES LES VIDÉOS
===================================================== */

exports.getVideos = async (req, res) => {
  try {
    const videos = await Video.find()
      .populate("produitId", "title")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      message: "Vidéos récupérées avec succès.",
      videos,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Erreur lors de la récupération des vidéos.",
      error: error.message,
    });
  }
};

/* =====================================================
   GET VIDÉOS PRODUITS — PUBLIC
===================================================== */

exports.getVideosProduitsPublic = async (req, res) => {
  try {
    const videos = await Video.find({
      produitId: { $ne: null },
    })
      .populate("produitId", "title")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      message: "Vidéos produits récupérées avec succès.",
      videos,
    });
  } catch (error) {
    console.error("GET VIDEOS PRODUITS PUBLIC ERROR:", error);

    return res.status(500).json({
      message: "Erreur lors de la récupération des vidéos produits.",
    });
  }
};


/* =====================================================
   SUPPRESSION VIDÉO
===================================================== */

exports.deletevideo = async (req, res) => {
  try {
    const { id } = req.params;

    const video = await Video.findById(id);

    if (!video) {
      return res.status(404).json({
        message: "Vidéo non trouvée.",
      });
    }

    // Supprimer Cloudinary
    await cloudinary.uploader.destroy(video.public_id, {
      resource_type: "video",
    });

    // Retirer la référence du produit
    if (video.produitId) {
      await Produits.findByIdAndUpdate(video.produitId, {
        $set: {
          videoId: null,
        },
      });
    }

    // Supprimer MongoDB
    await Video.findByIdAndDelete(id);

    return res.status(200).json({
      message: "Vidéo supprimée avec succès.",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Erreur lors de la suppression de la vidéo.",
      error: error.message,
    });
  }
};