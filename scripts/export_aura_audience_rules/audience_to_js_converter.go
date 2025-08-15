package main

import (
	"encoding/xml"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

const (
	audienceExt       = ".audience-meta.xml"
	audienceExtLen    = len(audienceExt)
	andFormulaType    = "AllCriteriaMatch"
	orFormulaType     = "AnyCriterionMatches"
	customFormulaType = "CustomLogicMatches"
)

// XML structure
type Audience struct {
	XMLName           xml.Name    `xml:"Audience"`
	AudienceName      string      `xml:"audienceName"`
	Criteria          []Criterion `xml:"criteria>criterion"`
	Formula           string      `xml:"formula"`
	FormulaFilterType string      `xml:"formulaFilterType"`
	IsDefaultAudience bool        `xml:"isDefaultAudience"`
	Targets           []Target    `xml:"targets>target"`
}

type Criterion struct {
	CriteriaNumber int            `xml:"criteriaNumber"`
	CriterionValue CriterionValue `xml:"criterionValue"`
	Operator       string         `xml:"operator"`
	Type           string         `xml:"type"`
}

func (cr Criterion) toCondition(obj2fields map[string]map[string]struct{}) (string, error) {
	var op string
	if cr.Operator == "Equal" {
		op = "=="
	} else if cr.Operator == "NotEqual" {
		op = "!="
	} else if cr.Operator == "StartsWith" {
		op = "=~"
	} else if cr.Operator == "EndsWith" {
		op = "~="
	} else {
		return "", fmt.Errorf("unknown operator: %s; Criterion: %+v", cr.Operator, cr)
	}

	if cr.Type == "Audience" {
		return fmt.Sprintf("Audience %s '%s'", op, cr.CriterionValue.AudienceDeveloperName), nil
	} else if cr.Type == "FieldBased" {
		fld := cr.CriterionValue.EntityField
		fld = strings.TrimPrefix(fld, "$")
		if !strings.HasPrefix(fld, cr.CriterionValue.EntityType) {
			fld = cr.CriterionValue.EntityType + "." + fld
		}
		fieldsSet, exists := obj2fields[cr.CriterionValue.EntityType]
		if !exists {
			fieldsSet = map[string]struct{}{}
		}
		fieldsSet[fld] = struct{}{}
		obj2fields[cr.CriterionValue.EntityType] = fieldsSet
		return fmt.Sprintf("%s %s '%s'", fld, op, cr.CriterionValue.FieldValue), nil
	} else if cr.Type == "Permission" {
		if cr.CriterionValue.PermissionType != "Custom" {
			return "", fmt.Errorf("unknown PermissionType: %s;", cr.CriterionValue.PermissionType)
		}
		return fmt.Sprintf("Permission %s '%s'", op, cr.CriterionValue.PermissionName), nil
	} else if cr.Type == "Profile" {
		return fmt.Sprintf("Profile %s '%s'", op, cr.CriterionValue.Profile), nil
	} else {
		return "", fmt.Errorf("unknown Criterion.Type: %s;", cr.Type)
	}
}

type CriterionValue struct {
	EntityField           string `xml:"entityField"`
	EntityType            string `xml:"entityType"`
	FieldValue            string `xml:"fieldValue"`
	IsEnabled             bool   `xml:"isEnabled"`
	PermissionName        string `xml:"permissionName"`
	PermissionType        string `xml:"permissionType"`
	AudienceDeveloperName string `xml:"audienceDeveloperName"`
	Profile               string `xml:"profile"`
}

type Target struct {
	GroupName   string `xml:"groupName"`
	Priority    int    `xml:"priority"`
	TargetType  string `xml:"targetType"`
	TargetValue string `xml:"targetValue"`
}

// JS result per audience
type audienceJS struct {
	audienceDevName string
	condition       string
}

func newAudienceJS(path string, meta *Audience, objs2fields map[string]map[string]struct{}) *audienceJS {
	audience_js := &audienceJS{
		audienceDevName: getAudienceDevNameFromFilePath(path),
	}

	var op string
	if meta.FormulaFilterType == andFormulaType {
		op = "&&"
	} else if meta.FormulaFilterType == orFormulaType {
		op = "||"
	} else {
		audience_js.condition = meta.Formula
		orRegExp := regexp.MustCompile("OR")
		andRegExp := regexp.MustCompile("AND")
		audience_js.condition = orRegExp.ReplaceAllString(audience_js.condition, "||")
		audience_js.condition = andRegExp.ReplaceAllString(audience_js.condition, "&&")
	}

	suffix := " " + op + " "
	// sort revers by Criteria number. This is in order to easily substitute bigger numbers first in
	// custom formula. For example 10 will be substituted before 1

	// We assume that custom formulas and our conditions are ASCII, not multi bytes, so we
	// are not going to use runes
	sort.Slice(meta.Criteria, func(i, j int) bool {
		return meta.Criteria[i].CriteriaNumber > meta.Criteria[j].CriteriaNumber
	})
	for _, criterion := range meta.Criteria {
		cond, err := criterion.toCondition(objs2fields)
		if err != nil {
			log.Fatal(err)
		}
		if op != "" {
			audience_js.condition += fmt.Sprintf("%s %s ", cond, op)
		} else {
			updatedCond, err := replacePosConditionInTarget(
				criterion.CriteriaNumber, cond, audience_js.condition,
			)
			if err != nil {
				log.Fatal(err)
			}
			audience_js.condition = updatedCond
		}
	}

	audience_js.condition = strings.TrimSuffix(audience_js.condition, suffix)

	return audience_js
}

func replacePosConditionInTarget(pos int, cond string, target string) (string, error) {
	indexStr := fmt.Sprintf("%d", pos) // Convert integer to string for substitution
	startPos := strings.Index(target, indexStr)
	if startPos == -1 {
		return "", fmt.Errorf("placeholder %d not found in target: %s; condition: %s;", pos, target, cond)
	}
	// Replace the numeric placeholder with its corresponding string
	return target[:startPos] + cond + target[startPos+len(indexStr):], nil
}

func getAudienceDevNameFromFilePath(path string) string {
	fnm := filepath.Base(path)
	return fnm[:len(fnm)-audienceExtLen]
}

func chkParams() (audienceDir string, lwcDir string) {
	tot := len(os.Args)
	if tot < 2 {
		fmt.Fprintf(os.Stderr, "\nUsage: \n\t%s <audience_metadata_directory> [lwc_components_directory]\n\n", filepath.Base(os.Args[0]))
		os.Exit(1)
	}

	audienceDir = os.Args[1]
	if tot >= 3 {
		lwcDir = os.Args[2]
	}
	return audienceDir, lwcDir
}

func saveAsJS(audiences []*audienceJS, objs2fields map[string]map[string]struct{}, lwcDir string) {
	// Audience rules in the JSON form
	jsCode := "export const Audiences = Object.freeze({\n"

	for _, ajs := range audiences {
		jsCode += fmt.Sprintf("\t\"%s\": \"%s\",\n\n", ajs.audienceDevName, ajs.condition)
	}
	jsCode = strings.TrimSuffix(jsCode, ",\n\n") + "\n});\n\n"

	// Objects to fields used in all rules. Needed for interpreter context
	jsCode += "export const ObjsToFields = Object.freeze({\n"
	for obj := range objs2fields {
		jsCode += fmt.Sprintf("\t\"%s\": [ ", obj)
		prefix := obj + "."
		for fld := range objs2fields[obj] {
			jsCode += fmt.Sprintf("\"%s\", ", strings.TrimPrefix(fld, prefix))
		}
		jsCode += "],\n\n"
	}
	jsCode = strings.TrimSuffix(jsCode, ",\n\n") + "\n});\n\n"

	audienceCheckerPath := filepath.Join(lwcDir, "audienceChecker")
	if _, err := os.Stat(audienceCheckerPath); os.IsNotExist(err) {
		fmt.Println(jsCode)
	} else {
		err = os.WriteFile(filepath.Join(audienceCheckerPath, "audiences.js"), []byte(jsCode), 0644)
		if err != nil {
			fmt.Fprintln(os.Stderr, "Error writing to audiences.js:", err)
			os.Exit(1)
		}
	}
}

func main() {
	audienceDir, lwcDir := chkParams()

	obj2fields := map[string]map[string]struct{}{}

	audiences := []*audienceJS{}
	err := filepath.Walk(audienceDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && strings.HasSuffix(info.Name(), audienceExt) {
			content, err := os.ReadFile(path)
			if err != nil {
				return err
			}
			var audience Audience
			err = xml.Unmarshal(content, &audience)
			if err != nil {
				return err
			}

			ajs := newAudienceJS(path, &audience, obj2fields)
			audiences = append(audiences, ajs)
		}
		return nil
	})
	if err != nil {
		fmt.Fprintln(os.Stderr, "Error reading audience metadata files:", err)
		os.Exit(1)
	}

	saveAsJS(audiences, obj2fields, lwcDir)
}
