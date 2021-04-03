const bodyParser = require('body-parser');
const express = require('express');
const speech = require('@google-cloud/speech');
const FileType = require('file-type');
const fs = require('fs');
const { createFFmpeg, fetchFile } = require('@ffmpeg/ffmpeg');

const ffmpeg = createFFmpeg({ log: true });

const app = express();

const config = {
  port: process.env.PORT || 8000,
};

app.use(
  bodyParser.raw({
    limit: 1024000,
    type: () => true,
  })
);

app.post('/asr', async (req, res) => {
  if (!ffmpeg.isLoaded()) {
    await ffmpeg.load();
  }
  try {
    ffmpeg.FS('writeFile', 'audio.ogg', req.body);
    await ffmpeg.run("-i", "audio.ogg", "audio.flac");
    const output = ffmpeg.FS("readFile", "audio.flac");

    const filename = './audio.flac';
    await fs.promises.writeFile(filename, output);

    const client = new speech.SpeechClient();

   const encoding = 'FLAC';
   const sampleRateHertz = 48000;
   const languageCode = 'en-US';
   
   const config = {
     encoding: encoding,
     sampleRateHertz: sampleRateHertz,
     languageCode: languageCode,
   };
   const audio = {
     content: fs.readFileSync(filename).toString('base64'),
   };
   
   const request = {
     config: config,
     audio: audio,
   };
   
   // Detects speech in the audio file
   const [response] = await client.recognize(request);
   const transcription = response.results
     .map((result) => result.alternatives[0].transcript)
     .join(' ');
   const confidence = response.results
     .map((result) => result.alternatives[0].confidence);
   console.log(`${Date.now()}: SUCCESS: ${transcription} - Language: ${languageCode}`);
   if (confidence.length >= 1) {
     res.status(200).json({
       status: 'ok',
       data: [
         {
           confidence: confidence[0],
           text: transcription,
         },
       ],
     });
   } else {
     console.log(`${Date.now()}: Returning 500.`);
     res.status(500).send('err');
   }
    
  } catch (error) {
    console.log(`${Date.now()}: ERROR: ${error}`);
    res.status(500).send('err');
  }
});

app.listen(config.port);
