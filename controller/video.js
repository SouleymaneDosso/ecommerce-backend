const cloudinary = require("../config/cloudinary");
const Video = require("../models/video");
const streamifier = require("streamifier");

exports.uploadervideo = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                message: "Aucune vidéo disponible actuellement."
            });
        }

        const uploaderPromises = req.files.map((file) => {
            return new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    {
                        folder: "numa/video",
                        resource_type: "video"
                    },
                    (error, result) => {
                        if (error) {
                            return reject(error);
                        }

                        resolve({
                            result,
                            file
                        });
                    }
                );

                streamifier
                    .createReadStream(file.buffer)
                    .pipe(stream);
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
                format: "jpg"
            })
        }));

        const videos = await Video.insertMany(nouvellesVideos);

        return res.status(201).json({
            message: "Vidéos uploadées avec succès.",
            videos
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: "Erreur lors de l'upload des vidéos.",
            error: error.message
        });
    }
};

exports.getVideos = async (req, res) => {
    try {
        const videos = await Video.find();
        return res.status(200).json({
            message: "Vidéos récupérées avec succès.",
            videos
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Erreur lors de la récupération des vidéos.",
            error: error.message
        });
    }
};

exports.deletevideo = async (req, res)=>{
    try{
        const { id } = req.params;
        const video = await Video.findById(id);
        if (!video) {
            return res.status(404).json({
                message: "Vidéo non trouvée."
            });
        }
        await cloudinary.uploader.destroy(video.public_id, { resource_type: "video" });
        await Video.findByIdAndDelete(id);
        return res.status(200).json({
            message: "Vidéo supprimée avec succès."
        });
    }catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Erreur lors de la suppression de la video.",
            error: error.message
        });
    }
}