const fs = require('fs');
const path = require('path');
const { guessHeaderIndex, guessDataStartingRow } = require('./src/apiHandler');
const { mapCSV, writeCSV } = require('./src/csvHandler');

const getBasePath = () => {
  // We are triggering this directly with node
  if (path.dirname(process.execPath).includes('node')) {
    return process.cwd();
  } else {
    // We are triggering this via pkg
    return path.dirname(process.execPath);
  }
}
const basePath = getBasePath();
const inputDirectoryPath = path.join(basePath, 'inputFiles');
const outputDirectoryPath = path.join(basePath, 'outputFiles');
const masterFilePath = path.join(outputDirectoryPath, 'combinedFiles.csv');
const desiredColumnOrder = ['email', 'first', 'last', 'street', 'city', 'state', 'zip', 'phone', 'lead_creation_date'];

const reorderColumns = (row, columnOrder, desiredColumnOrder) => {
  const reorderedRow = {};
  desiredColumnOrder.forEach((column) => {
    const index = Object.keys(columnOrder).find(key => columnOrder[key] === column);
    if (index !== undefined && row[index] !== undefined) {
      reorderedRow[column] = row[index];
    } else {
      reorderedRow[column] = '';
    }
  });
  return reorderedRow;
};

const writeHeadersToCSV = async (headers, outputFilePath) => {
  const writer = writeCSV(outputFilePath);
  const headerRow = headers.reduce((acc, header) => {
    acc[header] = header;
    return acc;
  }, {});

  await writer.writeRow(headerRow);
  await writer.endWriting();
};

const processCSV = async (inputFilePath, outputFilePath, desiredColumnOrder) => {
  try {
    const columnOrder = await guessHeaderIndex(inputFilePath, desiredColumnOrder);
    const startingIndex = await guessDataStartingRow(inputFilePath);
    await mapCSV(inputFilePath, outputFilePath, (row) => reorderColumns(row, columnOrder, desiredColumnOrder), startingIndex, true);
  } catch (error) {
    console.error(`Error during CSV processing for ${inputFilePath}:`, error);
  }
};

const processAllCSVsInDirectory = async (inputDirectoryPath, desiredColumnOrder) => {
  console.log("Processing all CSV files. This could take a few minutes...\n");
  try {
    if (fs.existsSync(masterFilePath)) {
      fs.unlinkSync(masterFilePath);
    }
    await writeHeadersToCSV(desiredColumnOrder, masterFilePath);
    const files = fs.readdirSync(inputDirectoryPath);
    for (const file of files) {
      if (path.extname(file) === '.csv') {
        const inputFilePath = path.join(inputDirectoryPath, file);
        console.log("Processing ", inputFilePath);
        await processCSV(inputFilePath, masterFilePath, desiredColumnOrder);
      }
    }
  } catch (error) {
    console.error("Error during processing all CSVs in directory:", error);
  }
};

processAllCSVsInDirectory(inputDirectoryPath, desiredColumnOrder)
  .then(() => console.log("All CSV files processed and combined into the master file."))
  .catch((err) => console.error("Error during processing:", err));
