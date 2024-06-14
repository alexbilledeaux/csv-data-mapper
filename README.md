# CSV Data Mapper

CSV Data Mapper is a tool designed to standardize and reformat CSV files by mapping headers to a predefined set of desired headers. This tool reads files from an input directory, processes them using the OpenAI API, and writes the reformatted data to an output directory.

## Features

- **Header Mapping:** Automatically maps headers in the CSV files to a standardized set of headers.
- **Data Reordering:** Reorders columns according to the specified desired column order.
- **Dynamic Row Detection:** Identifies the starting row of data, even when headers are not present.
- **Batch Processing**: Processes all CSV files in the input directory and combines them into a single output file.
- **Error Handling**: Provides detailed error messages for troubleshooting.

## Installation

1. Clone the repository to your local machine:

   ```bash
   git clone https://github.com/alexbilledeaux/csv-data-mapper.git
   cd csv-data-mapper
   ```
2. Install the required dependencies:

   ```bash
   npm install
   ```

## Usage

1. Place the CSV files you want to reformat into the `inputFiles` directory.
2. Run the script:
   ```bash
   npm start
   ```
3. The reformatted CSV files will be saved in the `outputFiles` directory.

## Packaging

To package the project into a distributable format using `pkg`, use the provided npm script:

1. Package the project:

   ```bash
   npm run build
   ```
2. The executables for different platforms will be created in the `dist` directory, with versions for Linux, macOS, and Windows.

## Configuration

- **Column Order:** You can customize the order and content of the resulting CSV file by modifying the COLUMNS array in a config.json file at the application's root. COLUMNS is an array of objects, each with an 'index', 'label', 'description', and 'required' field. OpenAI will use the description to better detect the information and will not include any rows that are missing columns marked as 'required'.
- **OpenAI Key:** Place your OPENAI_KEY in a config.json file at the application's root.

## License

This project is licensed under the MIT License.
