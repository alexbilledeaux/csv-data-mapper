const fs = require('fs');
const path = require('path');
const { guessHeaderIndex, guessDataStartingRow } = require('./src/apiHandler');
const { mapCSV, deleteLines, writeCSV } = require('./src/csvHandler');

const desiredColumnOrder = ['email', 'first', 'last', 'street', 'city', 'state', 'zip', 'phone', 'lead_creation_date'];
const inputDirectoryPath = path.join(process.cwd(), 'inputFiles');
const outputDirectoryPath = path.join(process.cwd(), 'outputFiles');
const masterFilePath = path.join(outputDirectoryPath, 'combinedFiles.csv');

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
    const tempFilePath = path.join(
      path.dirname(inputFilePath),
      `${path.basename(inputFilePath, path.extname(inputFilePath))}_temp${path.extname(inputFilePath)}`
    );

    const columnOrder = await guessHeaderIndex(inputFilePath, desiredColumnOrder);
    const startingIndex = await guessDataStartingRow(inputFilePath);
    await deleteLines(inputFilePath, tempFilePath, 0, startingIndex);
    await mapCSV(tempFilePath, outputFilePath, (row) => reorderColumns(row, columnOrder, desiredColumnOrder), true);
    fs.unlinkSync(tempFilePath);
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
