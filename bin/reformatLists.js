#!/usr/bin/env node

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');
const stringify = require('csv-stringify/lib/sync');
const OpenAI = require('openai');

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

// Remove the BOM of the input CSV
const removeBOM = (content) => {
    if (content.charCodeAt(0) === 0xFEFF) {
        return content.slice(1);
    }
    return content;
};

const writeOutputFile = (outputFilePath, reorderedData, reorderedHeaders) => {
    const output = stringify(reorderedData, { header: true, columns: reorderedHeaders });
    fs.writeFile(outputFilePath, output, 'utf8', (err) => {
        if (err) {
            console.error(`Error writing file ${outputFilePath}:`, err);
        } else {
            console.log(`Successfully wrote ${outputFilePath}.`);
        }
    });
};

const getOpenAiResponse = async (messages) => {
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
const guessHeaders = async (headerList, sampleValues) => {
    const messages = [
        { role: "system", content: `You are a helpful AI assistant that automatically detects data types in CSVs.` },
        { role: "user", content: `Given the following column headers and their first five values:
Headers: ${headerList.join(', ')}
Values: ${sampleValues.map((values, index) => `${headerList[index]}: ${values.join(', ')}`).join('; ')}
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
        { role: "user", content: `Examine the following column headers: ${firstRow.join(', ')}. Are these labels for data, or values for data? Respond with LABELS or VALUES and no other text.` }
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
        if (response == "LABELS") {
            return true;
        } else {
            return false;
        }
    } catch (error) {
        console.error('OpenAI Error:', error);
        return null;
    }
}

const reformatCsvWithHeaders = (inputFilePath, outputFilePath) => {
    const results = [];
    let headers = [];
    let headerMap;
    const sampleValues = {};

    fs.readFile(inputFilePath, 'utf8', async (err, data) => {
        if (err) {
            console.error(`Error reading file ${inputFilePath}:`, err);
            return;
        }

        const content = removeBOM(data);
        const parser = csvParser();

        parser.on('headers', (headerList) => {
            headers = headerList;
            headerList.forEach(header => {
                sampleValues[header] = [];
            });
        });

        parser.on('data', (row) => {
            results.push(row);
            headers.forEach(header => {
                if (sampleValues[header].length < 5) {
                    sampleValues[header].push(row[header]);
                }
            });
        });

        parser.on('end', async () => {
            const sampleArray = headers.map(header => sampleValues[header]);
            headerMap = await guessHeaders(headers, sampleArray);
            headers = Object.keys(headerMap).map(header => headerMap[header]);
            console.log(`File ${inputFilePath} Remapped Headers: ${headers}`);
            if (headers && headers.length > 0) {
                const reorderedHeaders = columnOrder.filter(column => headers.includes(column));
                console.log(`Reordered headers: ${reorderedHeaders}`);
                const reorderedData = results.map(row => {
                    const reorderedRow = {};
                    reorderedHeaders.forEach(column => {
                        const originalHeader = Object.keys(headerMap).find(key => headerMap[key] === column);
                        reorderedRow[column] = row[originalHeader] || '';
                    });
                    return reorderedRow;
                });

                writeOutputFile(outputFilePath, reorderedData, reorderedHeaders);
            } else {
                console.log(`File ${inputFilePath} does not contain any of the required headers and will be ignored.`);
            }
        });

        // Write content to the parser
        parser.write(content);
        parser.end();
    });
};

const reformatCsvWithoutHeaders = (inputFilePath, outputFilePath) => {
    const results = [];
    const sampleValues = {};

    fs.readFile(inputFilePath, 'utf8', async (err, data) => {
        if (err) {
            console.error(`Error reading file ${inputFilePath}:`, err);
            return;
        }

        const content = removeBOM(data);
        const parser = csvParser({ headers: false });

        parser.on('data', (row) => {
            results.push(row);
            Object.keys(row).forEach((index) => {
                if (!sampleValues[index]) {
                    sampleValues[index] = [];
                }
                if (sampleValues[index].length < 5) {
                    sampleValues[index].push(row[index]);
                }
            });
        });

        parser.on('end', async () => {
            const sampleArray = Object.keys(sampleValues).map(index => sampleValues[index]);
            const headerMap = await guessHeadersFromData(sampleArray);
            const headers = Object.values(headerMap);
            const reorderedHeaders = columnOrder.filter(column => headers.includes(column));

            console.log(`Reordered headers: ${reorderedHeaders}`);

            const reorderedData = results.map(row => {
                const reorderedRow = {};
                Object.keys(headerMap).forEach(index => {
                    const column = headerMap[index];
                    reorderedRow[column] = row[index] || '';
                });
                return reorderedRow;
            });

            writeOutputFile(outputFilePath, reorderedData, reorderedHeaders);
        });

        // Write content to the parser
        parser.write(content);
        parser.end();
    });
};

// Reformat a single input CSV
const reformatFile = async (inputFilePath, outputFilePath) => {
    console.log(await csvHasHeaders(inputFilePath));
    if (await csvHasHeaders(inputFilePath)) {
        reformatCsvWithHeaders(inputFilePath, outputFilePath);
    } else {
        reformatCsvWithoutHeaders(inputFilePath, outputFilePath);
    }
};

// Reformat every file in the input directory
const reformatLists = () => {
    fs.readdir(inputDir, (err, files) => {
        if (err) {
            console.error('Error reading input directory:', err);
            return;
        }

        files.forEach(file => {
            const inputFilePath = path.join(inputDir, file);
            const outputFilePath = path.join(outputDir, file);

            reformatFile(inputFilePath, outputFilePath);
        });
    });
};

reformatLists();
