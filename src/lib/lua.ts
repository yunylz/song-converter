import fs from "fs";
import * as luaparse from 'luaparse';

export default (input: string): any => {
  const content = fs.readFileSync(input, "utf8");
  
  try {
    const ast = luaparse.parse(content);
    return astToJson(ast);
  } catch (error) {
    console.error("Failed to parse Lua file:", error);
    return null;
  }
};

function astToJson(node: any): any {
  if (!node || typeof node !== 'object') {
    return node;
  }

  switch (node.type) {
    case 'Chunk':
      const result: any = {};
      for (const statement of node.body) {
        const converted = astToJson(statement);
        if (converted && typeof converted === 'object') {
          Object.assign(result, converted);
        }
      }
      return result;

    case 'AssignmentStatement':
      const assignments: any = {};
      for (let i = 0; i < node.variables.length; i++) {
        const variable = node.variables[i];
        const value = node.init[i];
        
        if (variable.type === 'Identifier') {
          assignments[variable.name] = astToJson(value);
        }
      }
      return assignments;

    case 'TableConstructorExpression':
      if (!node.fields || node.fields.length === 0) {
        return {};
      }

      // Check if this should be an array or object
      const hasKeys = node.fields.some((field: any) => 
        field.type === 'TableKeyString' || field.type === 'TableKey'
      );
      
      if (!hasKeys) {
        // Pure array - all TableValue
        return node.fields.map((field: any) => astToJson(field.value));
      } else {
        // Object with keys
        const obj: any = {};
        for (const field of node.fields) {
          let key: string;
          let value: any;
          
          if (field.type === 'TableKeyString') {
            // Handle: KEY = value (identifier key)
            key = field.key.name;
            value = astToJson(field.value);
          } else if (field.type === 'TableKey') {
            // Handle: ["key"] = value or [expr] = value
            key = getKeyValue(field.key);
            value = astToJson(field.value);
          } else if (field.type === 'TableValue') {
            // Handle array-like values in mixed table
            const index = node.fields.indexOf(field);
            key = index.toString();
            value = astToJson(field.value);
          } else {
            continue;
          }
          
          obj[key] = value;
        }
        return obj;
      }

    case 'StringLiteral':
      // luaparse stores the value in 'raw' with quotes, so we need to strip them
      if (node.raw) {
        return node.raw.slice(1, -1); // Remove surrounding quotes
      }
      return node.value;

    case 'NumericLiteral':
      return node.value;

    case 'BooleanLiteral':
      return node.value;

    case 'NilLiteral':
      return null;

    case 'Identifier':
      return node.name;

    case 'MemberExpression':
      // Handle things like NumCoach.Solo
      const base = astToJson(node.base);
      const identifier = astToJson(node.identifier);
      return `${base}.${identifier}`;

    case 'CallExpression':
      return null;

    case 'CallStatement':
      return null;
    
    case 'UnaryExpression':
      if (node.operator === '-' && node.argument.type === 'NumericLiteral') {
        return -node.argument.value;
      }
      return node;

    default:
      console.warn(`Unhandled AST node type: ${node.type}`);
      return node;
  }
}

function getKeyValue(keyNode: any): string {
  switch (keyNode.type) {
    case 'Identifier':
      return keyNode.name;
    case 'StringLiteral':
      return keyNode.value;
    case 'NumericLiteral':
      return keyNode.value.toString();
    default:
      return 'unknown';
  }
}