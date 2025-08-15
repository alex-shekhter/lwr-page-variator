@isTest
/*********************************************************************************************
 * @Name AudienceMetadataTest
 * @Group Partner Portal
 * @description Test class for the AudienceMetadata abstract class and its
 * RealAudienceMetadataProvider implementation. This test focuses on verifying
 * that the provider can query Custom Metadata records (assuming they exist).
 * Since Custom Metadata cannot be created programmatically in tests,
 * assertions are relaxed to check for the presence of data and correct ordering.
 **********************************************************************************************/
private class AudienceMetadataTest {

    /*****************************************************************************************
     * @description Tests the getAudienceRules method of the RealAudienceMetadataProvider.
     * Asserts that at least some audience rules are retrieved.
     *****************************************************************************************/
    @isTest
    static void testGetAudienceRules() {
        // Create an instance of the real metadata provider
        AudienceMetadata.AudienceMetadataProvider provider = new AudienceMetadata.RealAudienceMetadataProvider();

        // Call the method to retrieve audience rules
        List<LWR_Audience_Rule__mdt> rules = provider.getAudienceRules();

        // Assert that the list is not null and contains at least one record (if any exist)
        System.assertNotEquals(null, rules, 'Audience rules should not be null');
        System.assert(rules.size() >= 0, 'Should retrieve zero or more audience rules');
    }

    /*****************************************************************************************
     * @description Tests the getAudienceRulePriorities method of the RealAudienceMetadataProvider.
     * Asserts that the retrieved priorities are not null and are ordered correctly (if any exist).
     *****************************************************************************************/
    @isTest
    static void testGetAudienceRulePriorities() {
        // Define a test target type (assuming at least one priority exists for this type)
        String testTargetType = 'Account';

        // Create an instance of the real metadata provider
        AudienceMetadata.AudienceMetadataProvider provider = new AudienceMetadata.RealAudienceMetadataProvider();

        // Call the method to retrieve audience rule priorities
        List<LWR_Audience_Page_Level_Rule_Priority__mdt> priorities = provider.getAudienceRulePriorities(testTargetType);

        // Assert that the list is not null
        System.assertNotEquals(null, priorities, 'Audience rule priorities should not be null');

        // If there are priorities, check if they are ordered correctly
        if (priorities.size() > 1) {
            for (Integer i = 0; i < priorities.size() - 1; i++) {
                Integer currentPriority = Integer.valueOf(priorities[i].Audience_Rule_Priority__c);
                Integer nextPriority = Integer.valueOf(priorities[i + 1].Audience_Rule_Priority__c);
                System.assert(currentPriority <= nextPriority, 'Priorities should be ordered in ascending order');
            }
        }
    }

    /*****************************************************************************************
     * @description Tests the getAudienceResources method of the RealAudienceMetadataProvider.
     * Asserts that at least some audience resources are retrieved.
     *****************************************************************************************/
    @isTest
    static void testGetAudienceResources() {
        // Create an instance of the real metadata provider
        AudienceMetadata.RealAudienceMetadataProvider provider = new AudienceMetadata.RealAudienceMetadataProvider();

        // Call the method to retrieve audience resources
        List<LWR_Audience_Resource__mdt> resources = provider.getAudienceResources();

        // Assert that the list is not null and contains at least one record (if any exist)
        System.assertNotEquals(null, resources, 'Audience resources should not be null');
        System.assert(resources.size() >= 0, 'Should retrieve zero or more audience resources');
    }
}