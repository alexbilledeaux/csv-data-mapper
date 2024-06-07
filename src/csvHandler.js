const fs = require('fs');
const csv = require('csv-parser');
const stringify = require('csv-stringify');
const removeBOM = require('remove-bom-stream');

const readCSV = async (filePath, processRow, startingIndex, numOfLines) => {
  return new Promise((resolve, reject) => {
    let lineCount = 0;

    const stream = fs.createReadStream(filePath)
      .pipe(removeBOM('utf-8'))
      .pipe(csv({ headers: false }))
      .on('data', async (data) => {
        if (lineCount < startingIndex) {
          lineCount++;
          return; // Ignore rows before startingIndex
        }
        if (numOfLines && (lineCount - startingIndex) >= numOfLines) {
          stream.unpipe();
          resolve();
          return;
        }
        await processRow(data);
        lineCount++;
      })
      .on('end', resolve)
      .on('error', (err) => {
        console.error('Error reading CSV:', err);
        reject(err);
      });
  });
};

const writeCSV = (filePath, append = false) => {
  const writableStream = fs.createWriteStream(filePath, { flags: append ? 'a' : 'w' });
  const stringifier = stringify();
  stringifier.pipe(writableStream);

  const writeRow = (row) => {
    return new Promise((resolve, reject) => {
      stringifier.write(row, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  };

  const endWriting = () => {
    return new Promise((resolve) => {
      stringifier.end();
      writableStream.on('finish', resolve);
    });
  };

  return { writeRow, endWriting };
};

const mapCSV = async (inputFilePath, outputFilePath, processRow, startingIndex, append = false) => {
  const writer = writeCSV(outputFilePath, append);

  await readCSV(inputFilePath, async (row) => {
    const processedRow = await processRow(row);
    await writer.writeRow(processedRow);
  }, startingIndex);

  await writer.endWriting();
};

module.exports = { readCSV, writeCSV, mapCSV };
