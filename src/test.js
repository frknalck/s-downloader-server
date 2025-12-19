/**
 * Test script for URL decryption and Smule API
 */

import { processRecording } from './urlDecryptor.js';
import { extractPerformanceKey, fetchPerformance, processPerformanceData } from './smuleClient.js';

console.log('🧪 Testing Smule Downloader Components\n');

// Test 1: URL Decryption
console.log('Test 1: URL Decryption');
console.log('='.repeat(50));

const testEncryptedUrl = "e:TT18WlV5TXVeLXFXYn1WTF5qSmR9TXYpOHklYlFXWGY+SUZCRGNKPiU4emcyQ2l8dGVsamBkVlpA";
const testPlainUrl = "https://example.com/test.mp4";

try {
  console.log('Plain URL test:', testPlainUrl);
  const result1 = processRecording(testPlainUrl);
  console.log('✅ Result:', result1);
} catch (error) {
  console.log('❌ Error:', error.message);
}

console.log('\n');

// Test 2: Performance Key Extraction
console.log('Test 2: Performance Key Extraction');
console.log('='.repeat(50));

const testUrls = [
  'https://www.smule.com/p/1234567890/1234567890',
  'https://www.smule.com/recording/username/song-title/1234567890',
];

testUrls.forEach(url => {
  const key = extractPerformanceKey(url);
  console.log(`URL: ${url}`);
  console.log(`Key: ${key}`);
  console.log('');
});

// Test 3: Full API Test (requires actual Smule URL)
console.log('Test 3: Full API Test');
console.log('='.repeat(50));

const smuleUrl = process.argv[2];

if (smuleUrl) {
  console.log(`Testing with URL: ${smuleUrl}\n`);

  (async () => {
    try {
      const key = extractPerformanceKey(smuleUrl);
      console.log('✅ Performance Key:', key);

      console.log('\nFetching performance data...');
      const rawData = await fetchPerformance(key);
      console.log('✅ Raw data received');

      console.log('\nProcessing data...');
      const processed = processPerformanceData(rawData);

      console.log('\n📊 Performance Info:');
      console.log('  Title:', processed.title);
      console.log('  Artist:', processed.artist);
      console.log('  Duration:', processed.songLength, 'seconds');
      console.log('  Cover URL:', processed.coverUrl);
      console.log('  Media URL:', processed.mediaUrl ? '✅ Decrypted' : '❌ Not available');
      console.log('  Video URL:', processed.videoMediaMp4Url ? '✅ Decrypted' : '❌ Not available');

      if (processed.mediaUrl) {
        console.log('\n🔗 Decrypted Media URL:');
        console.log(processed.mediaUrl.substring(0, 100) + '...');
      }

    } catch (error) {
      console.error('\n❌ Test failed:', error.message);
    }
  })();
} else {
  console.log('ℹ️  To test with a real Smule URL, run:');
  console.log('   node src/test.js "https://www.smule.com/p/..."');
}
