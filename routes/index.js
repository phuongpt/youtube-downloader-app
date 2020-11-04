const express = require("express");
const cors = require("cors");
const router = express.Router();
const ytdl = require("youtube-dl");
const ytdlCore = require("ytdl-core");
const request = require("request");
const _ = require("underscore");
const { getSubtitles } = require("youtube-captions-scraper");
const getYouTubeID = require("get-youtube-id");
import translate, { parseMultiple } from "google-translate-open-api";
import { toVttTime } from "subtitle";

/* GET home page. */
router.get("/", function (req, res, next) {
  res.render("index", { title: "Youtube Talkdy" });
});

// convert to human readable format
function bytesToSize(bytes) {
  var sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (bytes == 0) return "0 Byte";
  var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  return Math.round(bytes / Math.pow(1024, i), 2) + " " + sizes[i];
}

router.post("/video", function (req, res, next) {
  var url = req.body.url,
    formats = [],
    pattern = /^((?:https?:)?\/\/)?((?:www|m)\.)?((?:youtube\.com|youtu.be))(\/(?:[\w\-]+\?v=|embed\/|v\/)?)([\w\-]+)(\S+)?$/;

  request.get(url, function (err, resp, body) {
    // check if it is valid url
    if (pattern.test(resp.request.uri.href)) {
      ytdl.getInfo(url, ["--youtube-skip-dash-manifest"], function (err, info) {
        if (err)
          return res.render("listvideo", {
            error:
              "The link you provided either not a valid url or it is not acceptable",
          });

        // push all video formats for download (skipping audio)
        info.formats.forEach(function (item) {
          if (item.format_note !== "DASH audio" && item.filesize) {
            item.filesize = item.filesize
              ? bytesToSize(item.filesize)
              : "unknown";
            formats.push(item);
          }
        });
        res.render("listvideo", { meta: { id: info.id, formats: formats } });
      });
    } else {
      res.render("listvideo", {
        error:
          "The link you provided either not a valid url or it is not acceptable",
      });
    }
  });
});

const getYouTubeSubtitles = async (youtubeUrl, lang) => {
  try {
    const videoID = getYouTubeID(youtubeUrl);
    const subtitles = await getSubtitles({ videoID, lang });
    return subtitles;
  } catch (error) {
    console.log({ error });
    return [];
  }
};

const parseVideo = async (url, lang) => {
  const info = await ytdlCore.getInfo(url);

  //get video url
  const formats = ytdlCore.filterFormats(info.formats, "video");
  const files = formats.filter(({ container, quality, hasAudio }) =>  container === 'mp4' && hasAudio === true);

  //info
  const { videoDetails, lengthSeconds } = info;

  //get subtitle
  const subtitle = await getYouTubeSubtitles(url, lang);
  const newSubtitle = (subtitle || []).map(({ start, dur, text }) => ({
    start: toVttTime(start * 1000),
    end: toVttTime(start * 1000 + dur * 1000),
    text,
  }));
  return {
    url: files[0].url,
    urls: files.map(file=>file.url),
    subtitle: newSubtitle,
    videoDetails,
    lengthSeconds,
  };
};

router.post("/parse", cors(), async function (req, res) {
  var url = req.body.url,
    lang = req.body.lang || "en";

  try {
    const info = await parseVideo(url, lang);
    res.send(info);
  } catch (error) {
    res.send({ error: error.message });
  }
});

router.get("/parse", cors(), async function (req, res) {
  var url = req.query.url,
    lang = req.query.lang || "en";

  try {
    const info = await parseVideo(url, lang);
    res.send(info);
  } catch (error) {
    res.send({ error: error.message });
  }
});

router.post("/translate", cors(), async function (req, res) {
  try {
    const text = req.body.text;
    const to = req.body.to || "vi";
    const resp = await translate(text, {
      tld: "com",
      to,
    });

    const translated = resp.data[0];

    const parsedData = _.isArray(translated)
      ? parseMultiple(translated).join(".")
      : translated;

    res.send({ text: parsedData });
  } catch (error) {
    res.send({ error: error.message });
  }
});

router.post;

module.exports = router;
