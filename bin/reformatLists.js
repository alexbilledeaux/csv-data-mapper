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

// OpenAI guesses the header for each column of the input CSV
const guessHeaders = async (headerList) => {
    const messages = [
        { role: "system", content: `You are a helpful AI assistant that automatically detects data types in CSVs.` },
        { role: "user", content: `Given the following column headers: ${headerList.join(', ')}, map them to the most appropriate standardized headers from this list: ${columnOrder.join(', ')}. Provide the mapping in the format 'original_header: standardized_header'. Respond with no additional text.` }
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
        const mappings = response.split('\n');
        const headerMap = {};
        mappings.forEach(mapping => {
            const [original, standardized] = mapping.split(':').map(s => s.trim());
            headerMap[original] = standardized;
        });
        console.log(headerMap)
        return headerMap;
    } catch (error) {
        console.error('OpenAI Error:', error);
        return null;
    }
};

// Remove the BOM of the input CSV
const removeBOM = (content) => {
    if (content.charCodeAt(0) === 0xFEFF) {
        return content.slice(1);
    }
    return content;
};

// Reformat a single input CSV
const reformatFile = (inputFilePath, outputFilePath) => {
    const results = [];
    let headers = [];
    let headerMap;

    fs.readFile(inputFilePath, 'utf8', async (err, data) => {
        if (err) {
            console.error(`Error reading file ${inputFilePath}:`, err);
            return;
        }

        const content = removeBOM(data);
        const parser = csvParser();

        parser.on('headers', async (headerList) => {
            console.log(`File ${inputFilePath} Original Headers: ${headerList}`);
            headers = headerList;
        });

        // We aren't doing anything to the CSV data
        parser.on('data', (row) => {
            results.push(row);
        });

        parser.on('end', async() => {
            headerMap = await guessHeaders(headers);
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

                // Write the reordered data to the output file
                const output = stringify(reorderedData, { header: true, columns: reorderedHeaders });
                fs.writeFile(outputFilePath, output, 'utf8', (err) => {
                    if (err) {
                        console.error(`Error writing file ${outputFilePath}:`, err);
                    } else {
                        console.log(`Successfully wrote ${outputFilePath}.`);
                    }
                });
            } else {
                console.log(`File ${inputFilePath} does not contain any of the required headers and will be ignored.`);
            }
        });

        // Write content to the parser
        parser.write(content);
        parser.end();
    });
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
