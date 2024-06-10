const fs = require('fs');
const csv = require('csv-parser');
const stringify = require('csv-stringify');
const { pipeline } = require('stream');
const { promisify } = require('util');
const removeBOM = require('remove-bom-stream');
const pipelineAsync = promisify(pipeline);

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

const mapCSV = async (inputFilePath, outputFilePath, processRow, startingIndex = 0, append = false) => {
  const readStream = fs.createReadStream(inputFilePath);
  const writeStream = fs.createWriteStream(outputFilePath, { flags: append ? 'a' : 'w' });
  const stringifier = stringify();

  let lineCount = 0;

  const transformStream = new (require('stream')).Transform({
    objectMode: true,
    transform: async (row, encoding, callback) => {
      if (lineCount < startingIndex) {
        lineCount++;
        return callback(); // Ignore rows before startingIndex
      }

      try {
        const processedRow = await processRow(row);
        callback(null, processedRow);
        lineCount++;
      } catch (error) {
        callback(error);
      }
    }
  });

  try {
    await pipelineAsync(
      readStream,
      removeBOM('utf-8'),
      csv({ headers: false }),
      transformStream,
      stringifier,
      writeStream
    );

    console.log(`CSV processing completed successfully for ${inputFilePath}`);
  } catch (error) {
    console.error(`Error during CSV processing for ${inputFilePath}:`, error);
  }
};

module.exports = { readCSV, writeCSV, mapCSV };
