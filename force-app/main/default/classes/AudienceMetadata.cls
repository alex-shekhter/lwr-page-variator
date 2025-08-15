/*********************************************************************************************
 * @description Abstract base class defining the structure for accessing audience-related metadata.
 * It includes an interface for the provider and a concrete implementation
 * for accessing real Custom Metadata records.
 **********************************************************************************************/
public inherited sharing abstract class AudienceMetadata {

    /*********************************************************************************************
     * @description Interface defining the contract for providing audience-related metadata.
     * Implementations of this interface will be responsible for fetching
     * audience rules, priorities, and resource definitions.
     **********************************************************************************************/
    public interface AudienceMetadataProvider {
        /*****************************************************************************************
         * @description Retrieves all active audience rule Custom Metadata records.
         * @return      A list of LWR_Audience_Rule__mdt records.
         *****************************************************************************************/
        List<LWR_Audience_Rule__mdt> getAudienceRules();

        /*****************************************************************************************
         * @description Retrieves audience rule priority Custom Metadata records for a specific target type.
         * @param   targetType The API name of the SObject or page for which to retrieve priorities.
         * @return      A list of LWR_Audience_Page_Level_Rule_Priority__mdt records, ordered by priority.
         *****************************************************************************************/        
        List<LWR_Audience_Page_Level_Rule_Priority__mdt> getAudienceRulePriorities(String targetType);

        /*****************************************************************************************
         * @description Retrieves all audience resource Custom Metadata records.
         * @return      A list of LWR_Audience_Resource__mdt records.
         *****************************************************************************************/        
        List<LWR_Audience_Resource__mdt> getAudienceResources();        
    }

    /*********************************************************************************************
     * @description Concrete implementation of the AudienceMetadataProvider interface that fetches
     * audience-related metadata directly from Custom Metadata records in Salesforce.
     **********************************************************************************************/
    public inherited sharing class RealAudienceMetadataProvider implements AudienceMetadataProvider {

        /*****************************************************************************************
         * @description Retrieves all active audience rule Custom Metadata records.
         * @return      A list of LWR_Audience_Rule__mdt records fetched using SOQL.
         *****************************************************************************************/
        public List<LWR_Audience_Rule__mdt> getAudienceRules() {
            return [SELECT Id, Audience_Id__c, Audience_Rule__c FROM LWR_Audience_Rule__mdt WITH SYSTEM_MODE];
        }
    
        /*****************************************************************************************
         * @description Retrieves audience rule priority Custom Metadata records for a specific target type.
         * @param   targetType The API name of the SObject or page for which to retrieve priorities.
         * @return      A list of LWR_Audience_Page_Level_Rule_Priority__mdt records fetched using SOQL,
         * ordered by Audience_Rule_Priority__c in ascending order.
         *****************************************************************************************/
        public List<LWR_Audience_Page_Level_Rule_Priority__mdt> getAudienceRulePriorities(String targetType) {
            return [SELECT Audience_Rule_Id__c, Audience_Rule_Priority__c, SObject__c
                    FROM LWR_Audience_Page_Level_Rule_Priority__mdt
                    WHERE SObject__c = :targetType
                    WITH SYSTEM_MODE
                    ORDER BY Audience_Rule_Priority__c ASC];
        }
    
        /*****************************************************************************************
         * @description Retrieves all audience resource Custom Metadata records.
         * @return      A list of LWR_Audience_Resource__mdt records fetched using SOQL.
         *****************************************************************************************/
        public List<LWR_Audience_Resource__mdt> getAudienceResources() {
            return [SELECT Sobject_API_Name__c, Fields_Array__c FROM LWR_Audience_Resource__mdt WITH SYSTEM_MODE];
        }
    }
}