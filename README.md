# CSV Data Mapper

## Overview

CSV Data Mapper is a tool designed to reformat CSV files by detecting and mapping headers to standardized headers using the OpenAI API. The tool reads CSV files from an input directory, examines the first five values of each column, processes them with OpenAI to guess the appropriate standardized headers, and writes the reformatted data to an output directory.

## Features

- Reads CSV files from the `inputLists` directory.
- Uses OpenAI API to guess and map column headers and sample values to a standardized format.
- Reorders columns based on a predefined column order.
- Writes the reformatted CSV files to the `outputLists` directory.
- Inserts headers if they are not present in the input files.

## Prerequisites

- Node.js installed on your machine.
- OpenAI API key.

## Installation

1. Clone the repository to your local machine:
    ```bash
    git clone https://github.com/yourusername/csv-data-mapper.git
    cd csv-data-mapper
    ```

2. Install the required dependencies:
    ```bash
    npm install
    ```

3. Create a `.env` file in the root directory and add your OpenAI API key:
    ```env
    OPENAI_KEY=your-api-key-here
    ```

## Usage

1. Place the CSV files you want to reformat into the `inputLists` directory.
2. Run the data mapper script:
    ```bash
    node bin/reformatLists.js
    ```
3. The reformatted CSV files will be saved in the `outputLists` directory.

## Packaging

To package the project into a distributable format using `pkg`:

1. Install `pkg` if you haven't already:
    ```bash
    npm install --save-dev pkg
    ```

2. Add the following `pkg` configuration to your `package.json`:
    ```json
    {
      "name": "csv-data-mapper",
      "version": "1.0.0",
      "description": "A tool to reformat and map CSV data.",
      "main": "bin/reformatLists.js",
      "bin": {
        "data-mapper": "./bin/reformatLists.js"
      },
      "scripts": {
        "start": "node bin/reformatLists.js"
      },
      "dependencies": {
        "csv-parser": "^3.0.0",
        "csv-stringify": "^5.0.0",
        "openai": "^4.0.0",
        "dotenv": "^10.0.0"
      },
      "devDependencies": {
        "pkg": "^5.3.1"
      },
      "pkg": {
        "scripts": "bin/reformatLists.js",
        "assets": [
          "node_modules/openai/**",
          "node_modules/openai/_shims/auto/runtime-node.js"
        ],
        "outputPath": "dist",
        "targets": [
          "node14-linux-x64",
          "node14-macos-x64",
          "node14-win-x64"
        ]
      },
      "author": "",
      "license": "MIT"
    }
    ```

3. Package the project:
    ```bash
    npx pkg . --out-path dist
    ```

4. The executables for different platforms will be created in the `dist` directory.

## License

This project is licensed under the MIT License.
