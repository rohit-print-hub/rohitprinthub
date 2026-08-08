const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const port = process.env.PORT || 3000;

// ===============================
// FOLDERS
// ===============================

const uploadFolder = path.join(__dirname, "Upload");
const queueFolder = path.join(__dirname, "PrintQueue");

fs.mkdirSync(uploadFolder, { recursive: true });
fs.mkdirSync(queueFolder, { recursive: true });


// ===============================
// WEBSITE
// ===============================

app.use(express.static(path.join(__dirname, "Public")));
app.use(express.json());


// ===============================
// FILE UPLOAD
// ===============================

const storage = multer.diskStorage({

    destination: function (req, file, cb) {
        cb(null, uploadFolder);
    },

    filename: function (req, file, cb) {

        const ext = path.extname(file.originalname);

        const filename =
            Date.now() +
            "-" +
            crypto.randomBytes(5).toString("hex") +
            ext;

        cb(null, filename);
    }

});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 25 * 1024 * 1024
    }
});


// ===============================
// CREATE PRINT JOB
// ===============================

app.post(
    "/upload",

    upload.fields([
        {
            name: "fileFront",
            maxCount: 1
        },
        {
            name: "fileBack",
            maxCount: 1
        }
    ]),

    (req, res) => {

        try {

            if (
                !req.files ||
                !req.files.fileFront ||
                !req.files.fileFront[0]
            ) {

                return res.status(400).send(
                    "❌ Front file missing."
                );

            }

            const frontFile = req.files.fileFront[0];

            let backFile = null;

            if (
                req.files.fileBack &&
                req.files.fileBack[0]
            ) {

                backFile = req.files.fileBack[0];

            }


            // ===============================
            // JOB ID
            // ===============================

            const jobId =
                Date.now() +
                "-" +
                crypto.randomBytes(5).toString("hex");


            // ===============================
            // PRINT JOB
            // ===============================

            const job = {

                jobId: jobId,

                status: "waiting",

                createdAt: new Date().toISOString(),

                shopId:
                    req.body.shopId ||
                    "default_shop",

                docType:
                    req.body.docType ||
                    "Normal",

                printType:
                    req.body.printType ||
                    "Black",

                paperSize:
                    req.body.paperSize ||
                    "A4",

                side:
                    req.body.side ||
                    "Single",

                copies:
                    parseInt(req.body.copies) || 1,

                frontFile:
                    frontFile.filename,

                backFile:
                    backFile
                        ? backFile.filename
                        : null

            };


            // ===============================
            // SAVE JOB
            // ===============================

            const jobPath = path.join(
                queueFolder,
                jobId + ".json"
            );

            fs.writeFileSync(
                jobPath,
                JSON.stringify(job, null, 2)
            );


            console.log(
                "NEW PRINT JOB:",
                jobId
            );


            res.status(200).json({

                success: true,

                message:
                    "✅ Print request received.",

                jobId: jobId

            });


        } catch (error) {

            console.error(
                "UPLOAD ERROR:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "❌ Server error."

            });

        }

    }
);


// ===============================
// PRINT AGENT GET JOBS
// ===============================

app.get(
    "/api/print-jobs",
    (req, res) => {

        try {

            const files =
                fs.readdirSync(queueFolder);

            const jobs = [];

            for (const file of files) {

                if (
                    !file.endsWith(".json")
                ) {
                    continue;
                }

                const filePath =
                    path.join(
                        queueFolder,
                        file
                    );

                const job =
                    JSON.parse(
                        fs.readFileSync(
                            filePath,
                            "utf8"
                        )
                    );


                if (
                    job.status === "waiting"
                ) {

                    jobs.push(job);

                }

            }


            res.json(jobs);


        } catch (error) {

            console.error(error);

            res.status(500).json({

                error:
                    "Unable to read print queue"

            });

        }

    }
);


// ===============================
// UPDATE PRINT JOB STATUS
// ===============================

app.post(
    "/api/print-jobs/:jobId/status",

    (req, res) => {

        try {

            const jobId =
                req.params.jobId;

            const jobPath =
                path.join(
                    queueFolder,
                    jobId + ".json"
                );


            if (
                !fs.existsSync(jobPath)
            ) {

                return res.status(404).json({

                    error:
                        "Job not found"

                });

            }


            const job =
                JSON.parse(
                    fs.readFileSync(
                        jobPath,
                        "utf8"
                    )
                );


            job.status =
                req.body.status ||
                "printed";


            job.updatedAt =
                new Date().toISOString();


            if (req.body.error) {

                job.error =
                    req.body.error;

            }


            fs.writeFileSync(
                jobPath,
                JSON.stringify(
                    job,
                    null,
                    2
                )
            );


            res.json({

                success: true,

                job: job

            });


        } catch (error) {

            console.error(error);

            res.status(500).json({

                error:
                    "Unable to update job"

            });

        }

    }
);


// ===============================
// DOWNLOAD PRINT FILE
// ===============================

app.get(
    "/api/files/:filename",

    (req, res) => {

        const filename =
            path.basename(
                req.params.filename
            );

        const filePath =
            path.join(
                uploadFolder,
                filename
            );


        if (
            !fs.existsSync(filePath)
        ) {

            return res.status(404).send(
                "File not found"
            );

        }


        res.download(filePath);

    }
);


// ===============================
// SERVER
// ===============================

app.listen(
    port,
    () => {

        console.log(
            `Server running on port ${port}`
        );

    }
);