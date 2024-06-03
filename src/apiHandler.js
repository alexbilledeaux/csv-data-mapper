const OpenAI = require('openai');
const path = require('path');
const fs = require('fs');
const { readCSV } = require('./csvHandler');

// Set up the OpenAI configuration
const getApiKey = () => {
    const configPath = path.resolve(__dirname, '../config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return config.OPENAI_KEY;
    } else {
      console.error('OpenAI API Key not found. Please set it in config.json.');+
      process.exit(1);
    }
}
  
const apiKey = getApiKey();
const openai = new OpenAI({
    apiKey: apiKey,
});

const guessDataStartingRow = async (filepath) => {
    const rows = [];
    const storeRow = (row) => {
        rows.push(row);
    }
    await readCSV(filepath, (row) => storeRow(row), null, 30);
    const messages = [
        { role: "system", content: `You are a helpful AI assistant that figures out the row in which data begins in a CSV.` },
        { role: "user", content: `Given the following rows of data: ${JSON.stringify(rows)}
        What is the index of the row where actual data begins? Respond with no other text.` }
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
        return response;
    } catch (error) {
        console.error('OpenAI Error:', error);
        return null;
    }
}

/**
 * When given a CSV filepath and a set of headers to locate,
 * guessHeaderIndex returns ChatGPT's best guess at the index for each each requested header.
*/
const guessHeaderIndex = async (filepath, headersToLocate) => {
    const rows = [];
    const storeRow = (row) => {
        rows.push(row);
    }
    await readCSV(filepath, (row) => storeRow(row), null, 5);

    const messages = [
        { role: "system", content: `You are a helpful AI assistant that normalizes headers in CSVs.` },
        { role: "user", content: `Given the following rows of data: ${JSON.stringify(rows)}
        Map them to the most appropriate standardized headers from this list: ${headersToLocate.join(', ')}. Provide the mapping in the format 'index: standardized_header'. Respond with no additional text.` }
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
        return headerMap;
    } catch (error) {
        console.error('OpenAI Error:', error);
        return null;
    }
}

module.exports = { guessHeaderIndex, guessDataStartingRow };