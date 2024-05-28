#!/usr/bin/env node

require('dotenv').config();

const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const csvParser = require('csv-parser');
const { createObjectCsvStringifier } = require('csv-writer');
const OpenAI = require('openai');
var removeBOM = require('remove-bom-stream');

// OpenAI Configuration
const apiKey = process.env.OPENAI_KEY;
const openai = new OpenAI({
    apiKey: apiKey,
});

// Get our location in the directory
const baseDir = path.dirname(process.execPath);
const inputDir = path.join(baseDir, 'inputLists');
const outputDir = path.join(baseDir, 'outputLists');

// Make sure the output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

// This is the required column order for our output CSV
const columnOrder = ['email', 'first', 'last', 'street', 'city', 'state', 'zip', 'phone', 'lead_creation_date'];

const getOpenAiResponse = async (messages) => {
    console.log("\n-----------\nMaking request to OpenAI...\n-------------\n");
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4-1106-preview",
            messages: messages,
            temperature: 0.1,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0
        });

        const response = completion.choices[0].message.content.trim();
        const mappings = response.split('\n');
        const headerMap = {};
        mappings.forEach(mapping => {
            const [original, standardized] = mapping.split(':').map(s => s.trim());
            headerMap[original] = standardized;
        });
        console.log(headerMap);
        return headerMap;
    } catch (error) {
        console.error('OpenAI Error:', error);
        return null;
    }
}

// OpenAI guesses the header for each column of the input CSV
const guessHeaders = async (headerList) => {
    const messages = [
        { role: "system", content: `You are a helpful AI assistant that automatically detects data types in CSVs.` },
        { role: "user", content: `Given the following column headers:
Headers: ${headerList.join(', ')}
Map them to the most appropriate standardized headers from this list: ${columnOrder.join(', ')}. Provide the mapping in the format 'original_header: standardized_header'. Respond with no additional text.` }
    ];
    let response = await getOpenAiResponse(messages);
    return response;
};

// OpenAI guesses the header for each column of the input CSV
const guessHeadersFromData = async (sampleValues) => {
    const messages = [
        { role: "system", content: `You are a helpful AI assistant that automatically detects data types in CSVs.` },
        { role: "user", content: `Given the following groups of data:
Data: ${sampleValues.map((values, index) => `${index}: ${values.join(', ')}`).join('; ')}
Map them to the most appropriate standardized headers from this list: ${columnOrder.join(', ')}. Provide the mapping in the format 'index: standardized_header'. Respond with no additional text.` }
    ];

    let response = await getOpenAiResponse(messages);
    return response;
};

const getHeaders = (filePath) => {
    return new Promise((resolve, reject) => {
        const headers = [];
        fs.createReadStream(filePath)
            .pipe(removeBOM('utf-8'))
            .pipe(csvParser())
            .on('headers', (headerList) => {
                headers.push(...headerList);
                resolve(headers);
            })
            .on('error', (err) => {
                reject(`Error reading file ${filePath}: ${err.message}`);
            });
    });
};

const csvHasHeaders = async (inputFilePath) => {
    let firstRow = await getHeaders(inputFilePath);
    const messages = [
        { role: "system", content: `You are a helpful AI assistant that automatically detects data types in CSVs.` },
        { role: "user", content: `Examine the following data: ${firstRow.join(', ')}. Would you assume these were column headers in a CSV, or column data in a CSV? Respond with HEADERS or DATA and no other text.` }
    ];
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4-1106-preview",
            messages: messages,
            temperature: 0.1,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0
        });
        const response = completion.choices[0].message.content.trim();
        if (response == "HEADERS") {
            return true;
        } else {
            return false;
        }
    } catch (error) {
        console.error('OpenAI Error:', error);
        return null;
    }
}


const getSampleValues = (filePath) => {
    return new Promise((resolve, reject) => {
        const sampleValues = {};
        fs.createReadStream(filePath)
            .pipe(removeBOM('utf-8'))
            .pipe(csvParser({ headers: false }))
            .on('data', (row) => {
                Object.keys(row).forEach((index) => {
                    if (!sampleValues[index]) {
                        sampleValues[index] = [];
                    }
                    if (sampleValues[index].length < 5) {
                        sampleValues[index].push(row[index]);
                    }
                });
                resolve(sampleValues);
            })
            .on('error', (err) => {
                reject(`Error reading file ${filePath}: ${err.message}`);
            });
    });
};

const reorderRow = (row, reorderedHeaders, headerMap) => {
    const reorderedRow = {};
    reorderedHeaders.forEach(column => {
        const originalHeader = Object.keys(headerMap).find(key => headerMap[key] === column);
        reorderedRow[column] = row[originalHeader] || '';
    });
    return reorderedRow;
};

const reformatCsvWithHeadersStream = async (inputFilePath, outputFilePath) => {
    let headers = await getHeaders(inputFilePath);
    console.log(headers);
    let headerMap = await guessHeaders(headers);
    headers = Object.keys(headerMap).map(header => headerMap[header]);
    const reorderedHeaders = columnOrder.filter(column => headers.includes(column));

    const csvStringifier = createObjectCsvStringifier({
        header: reorderedHeaders.map(header => ({ id: header, title: header }))
    });

    fs.writeFileSync(outputFilePath, csvStringifier.getHeaderString());

    return new Promise((resolve, reject) => {
        fs.createReadStream(inputFilePath)
            .pipe(removeBOM('utf-8'))
            .pipe(csvParser())
            .on('data', (row) => {
                let reorderedRow = reorderRow(row, reorderedHeaders, headerMap);
                fs.appendFileSync(outputFilePath, csvStringifier.stringifyRecords([reorderedRow]));
            })
            .on('end', () => {
                console.log('CSV file processing and writing completed.');
                resolve();
            })
            .on('error', (error) => {
                console.error(`Error reading the CSV file: ${error.message}`);
                reject(error);
            });
    });
}

const reformatCsvWithoutHeadersStream = async (inputFilePath, outputFilePath) => {
    let sampleValues = await getSampleValues(inputFilePath);
    const sampleArray = Object.keys(sampleValues).map(index => sampleValues[index]);
    const headerMap = await guessHeadersFromData(sampleArray);
    const headers = Object.values(headerMap);
    const reorderedHeaders = columnOrder.filter(column => headers.includes(column));

    const csvStringifier = createObjectCsvStringifier({
        header: reorderedHeaders.map(header => ({ id: header, title: header }))
    });

    fs.writeFileSync(outputFilePath, csvStringifier.getHeaderString());

    return new Promise((resolve, reject) => {
        fs.createReadStream(inputFilePath)
            .pipe(removeBOM('utf-8'))
            .pipe(csvParser({ headers: false }))
            .on('data', (row) => {
                console.log(row);
                let reorderedRow = reorderRow(row, reorderedHeaders, headerMap);
                fs.appendFileSync(outputFilePath, csvStringifier.stringifyRecords([reorderedRow]));
            })
            .on('end', () => {
                console.log('CSV file processing and writing completed.');
                resolve();
            })
            .on('error', (error) => {
                console.error(`Error reading the CSV file: ${error.message}`);
                reject(error);
            });
    });
}

// Reformat a single input CSV
const reformatFile = async (inputFilePath, outputFilePath) => {
    if (await csvHasHeaders(inputFilePath)) {
        await reformatCsvWithHeadersStream(inputFilePath, outputFilePath);
    } else {
        await reformatCsvWithoutHeadersStream(inputFilePath, outputFilePath);
    }
};

// Reformat every file in the input directory
const reformatLists = async () => {
    try {
        const files = await fsPromises.readdir(inputDir);

        const fileProcessingPromises = files
            .filter(file => file !== ".DS_Store")
            .map(async file => {
                const inputFilePath = path.join(inputDir, file);
                const outputFilePath = path.join(outputDir, file);
                await reformatFile(inputFilePath, outputFilePath);
            });

        await Promise.all(fileProcessingPromises);

        console.log('All files processed successfully');
    } catch (err) {
        console.error('Error reading input directory:', err);
        throw err;
    }
};

const combineOutputFiles = () => {
    const combinedOutputPath = path.join(outputDir, 'combined_output.csv');
    const csvStringifier = createObjectCsvStringifier({
        header: columnOrder.map(header => ({ id: header, title: header }))
    });

    // Write the header row to the combined file
    fs.writeFileSync(combinedOutputPath, csvStringifier.getHeaderString());

    fs.readdir(outputDir, (err, files) => {
        if (err) {
            console.error('Error reading output directory:', err);
            return;
        }

        files.forEach(file => {
            const filePath = path.join(outputDir, file);
            if (file !== ".DS_Store" && file !== 'combined_output.csv') {
                fs.createReadStream(filePath)
                    .pipe(removeBOM('utf-8'))
                    .pipe(csvParser())
                    .on('data', (row) => {
                        fs.appendFileSync(combinedOutputPath, csvStringifier.stringifyRecords([row]));
                    })
                    .on('end', () => {
                        console.log(`Finished processing ${file}`);
                    })
                    .on('error', (error) => {
                        console.error(`Error reading the CSV file ${file}: ${error.message}`);
                    });
            }
        });
    });
};

reformatLists()
    .then(() => {
        console.log('Reformatted all CSVs. Creating combined file...');
        combineOutputFiles();
    })
    .catch((err) => {
        console.error('Error during reformatting:', err);
    });
