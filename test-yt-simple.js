#!/usr/bin/env node
const twitter = require('./src/automation/twitter');
const { uploadBookmarks } = require('./src/automation/notebooklm');

async function test() {
  console.log('Extracting 5 bookmarks...\n');
  const result = await twitter.extractBookmarks({ limit: 5 });
  const bookmarks = result.data.bookmarks;
  
  console.log(`Uploading to NotebookLM...\n`);
  
  const uploadResult = await uploadBookmarks(bookmarks, {
    notebookName: 'BrainBrief TEST - YouTube Upload'
  });
  
  if (uploadResult.success) {
    console.log('\n✅ SUCCESS!');
    console.log(`Sources added: ${uploadResult.data.totalSourcesAdded}`);
    console.log(`YouTube sources: ${uploadResult.data.youtubeSourcesAdded}`);
    console.log(`Total sources in notebook: ${uploadResult.data.sourceCount}`);
  } else {
    console.log('\n❌ FAILED:', uploadResult.error);
  }
}

test();

