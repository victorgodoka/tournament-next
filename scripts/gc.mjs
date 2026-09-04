import fs from 'fs/promises';
import path from 'path';

function toPascalCase(str) {
  return str.replace(/(^\w|[-_]\w)/g, (text) => text.replace(/[-_]/, "").toUpperCase());
}

async function generateComponent() {
  const componentPathArg = process.argv[2];

  if (!componentPathArg) {
    console.error('\n❌ Error: Component path is required.');
    console.log('   Usage: pnpm generate:component {folder/component-name}');
    console.log('   Example: pnpm generate:component forms/SuperButton');
    console.log('   (If no folder is provided, it will default to "ui")\n');
    process.exit(1);
  }

  const parts = componentPathArg.split('/').filter(Boolean);
  const componentName = parts.pop();
  const folder = parts.length > 0 ? parts.join('/') : 'ui';

  if (!componentName) {
    console.error('\n❌ Error: Component name is missing.');
    process.exit(1);
  }

  const componentNamePascal = toPascalCase(componentName);
  const baseDir = path.resolve('components', folder, componentName);

  const files = {
    tsx: path.join(baseDir, `${componentName}.tsx`),
    index: path.join(baseDir, 'index.ts'),
  };

  const templates = {
    tsx: `interface ${componentNamePascal}Props {
  // TODO: Define component props
}

export const ${componentNamePascal} = ({}: ${componentNamePascal}Props) => {
  return (
    <div>
      {/* TODO: Implement ${componentNamePascal} component */}
    </div>
  );
};
`,
    index: `export { ${componentNamePascal} as default } from './${componentName}';
`,
  };

  try {
    await fs.mkdir(baseDir, { recursive: true });
    console.log(`✅ Created directory: ${path.relative(process.cwd(), baseDir)}`);

    for (const [type, filePath] of Object.entries(files)) {
      await fs.writeFile(filePath, templates[type]);
      console.log(`✅ Created file:      ${path.relative(process.cwd(), filePath)}`);
    }

    console.log(`\n🎉 Component '${componentNamePascal}' created successfully!`);
    console.log(`   You can now import it using: import ${componentNamePascal} from '@/components/${folder}/${componentName}';\n`);

  } catch (error) {
    console.error(`\n❌ Error generating component:`, error);
    process.exit(1);
  }
}

generateComponent();
