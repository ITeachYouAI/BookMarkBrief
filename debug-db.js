/**
 * Debug database initialization
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

async function debugInit() {
  try {
    console.log('1. Initializing sql.js...');
    const SQL = await initSqlJs();
    console.log('✅ sql.js initialized');
    
    console.log('2. Creating new database...');
    const db = new SQL.Database();
    console.log('✅ Database created');
    
    console.log('3. Reading schema file...');
    const schemaPath = path.join(__dirname, 'src/db/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    console.log('✅ Schema read:', schema.length, 'characters');
    
    console.log('4. Executing schema...');
    db.exec(schema);
    console.log('✅ Schema executed');
    
    console.log('5. Testing query...');
    const stmt = db.prepare('SELECT COUNT(*) as count FROM bookmarks');
    stmt.step();
    const result = stmt.getAsObject();
    stmt.free();
    console.log('✅ Query worked, count:', result.count);
    
    console.log('');
    console.log('✅ ALL GOOD - No errors found!');
    
  } catch (error) {
    console.error('❌ ERROR FOUND:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugInit();

