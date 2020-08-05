import * as core from '@actions/core';
import * as crypto from 'crypto';

import { AuthorizerFactory } from 'azure-actions-webclient/AuthorizerFactory';
import PsqlFilesExecutor from './PsqlFilesExecutor';
import AzurePSQLResourceManager from './Utils/FirewallUtils/ResourceManager';
import FirewallManager from './Utils/FirewallUtils/FirewallManager';
import PsqlUtils from './Utils/PsqlUtils/PsqlUtils';
import { ActionInputs } from './Utils/ActionInputs';

async function run() {
    const userAgentPrefix = !!process.env.AZURE_HTTP_USER_AGENT ? `${process.env.AZURE_HTTP_USER_AGENT}` : "";
    let firewallManager: FirewallManager;
    try {
        // Set user agent variable
        const usrAgentRepo = crypto.createHash('sha256').update(`${process.env.GITHUB_REPOSITORY}`).digest('hex');
        const actionName = 'AzurePSQLAction';
        const userAgentString = (!!userAgentPrefix ? `${userAgentPrefix}+` : '') + `GITHUBACTIONS_${actionName}_${usrAgentRepo}`;
        core.exportVariable('AZURE_HTTP_USER_AGENT', userAgentString);

        const actionInputs: ActionInputs = ActionInputs.getActionInputs();
        if (!await PsqlUtils.isConnectedToDB(actionInputs.connectionString)) {
            const azureResourceAuthorizer = await AuthorizerFactory.getAuthorizer();
            const azurePsqlResourceManager = await AzurePSQLResourceManager.getResourceManager(actionInputs.serverName, azureResourceAuthorizer);
            firewallManager = new FirewallManager(azurePsqlResourceManager);
            await firewallManager.addFirewallRule(actionInputs.serverName, actionInputs.connectionString);
        }
        const psqlFilesExecutor = new PsqlFilesExecutor(actionInputs.connectionString, actionInputs.filesPath, actionInputs.args);
        await psqlFilesExecutor.execute();
    }
    catch(error) {
        core.error(`Error occurred while running action:\n${error}`);
        core.setFailed(error.message);
    }
    finally {
        if (firewallManager) {
            await firewallManager.removeFirewallRule();
        }
        // Reset AZURE_HTTP_USER_AGENT
        core.exportVariable('AZURE_HTTP_USER_AGENT', userAgentPrefix);
    }
}

run();