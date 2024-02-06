const puppeteer = require("puppeteer");
const { PDFDocument } = require("pdf-lib");

require("dotenv").config();

const generatePdf = async (params) => {
  const page = await params.browser.newPage();
  await page.setContent(params.html, { waitUntil: "networkidle0" });
  await page.addStyleTag({
    content: `
      @page {
        size: A4;
        margin-top: 60pt;
        margin-bottom: 60pt;
        background-color: red;
      }
      @page :first {
        size: A4;
        margin-top: 0px;
        margin-bottom: 60pt;
      }
    `,
  });
  const pdfBuffer = await page.pdf();
  const base64 = pdfBuffer.toString("base64");
  return base64;
};

const scrapeLogic = async (req, res) => {
  const { docs } = req.body;
  if (!docs || !Array.isArray(docs)) {
    return res.status(400).send("Invalid request");
  }

  const browser = await puppeteer.launch({
    args: [
      "--disable-setuid-sandbox",
      "--no-sandbox",
      "--single-process",
      "--no-zygote",
    ],
    executablePath:
      process.env.NODE_ENV === "production"
        ? process.env.PUPPETEER_EXECUTABLE_PATH
        : puppeteer.executablePath(),
    width: 1192,
    height: 1684,
    deviceScaleFactor: 2,
  });
  try {
    const base64PDFs = await Promise.all(
      docs.map((doc) =>
        generatePdf({
          browser,
          html: doc,
        })
      )
    );

    const pdfDocs = await Promise.all(
      base64PDFs.map((base64PDF) => PDFDocument.load(base64PDF))
    );

    const mergedPDF = await PDFDocument.create();

    for (const pdfDoc of pdfDocs) {
      const pages = await mergedPDF.copyPages(pdfDoc, pdfDoc.getPageIndices());
      pages.forEach((page) => mergedPDF.addPage(page));
    }

    const mergedPDFBytes = await mergedPDF.saveAsBase64();

    res.send({ pdf: mergedPDFBytes });
  } catch (e) {
    console.error(e);
    res.send(`Something went wrong while running Puppeteer: ${e}`);
  } finally {
    await browser.close();
  }
};

module.exports = { scrapeLogic };
