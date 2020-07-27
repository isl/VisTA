/*
 * Copyright (C) 2015-2017, © Trustees of the British Museum
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, you can receive a copy
 * of the GNU Lesser General Public License from http://www.gnu.org/
 */

import { Rdf } from 'platform/api/rdf';
import { AlignmentRDF, SourceTermAlignmentType, TargetTermAlignmentType, } from './AlignmentRDF';

export module QueriesConfig {



    //At source queries we remove all the /*...*/ patterns. These patterns are used only for the target queries.
    export function constructSourceQueries(queries, prefices,
        typeRelation, typesRootQuery, typesParentQuery, typesChildrenQuery, typesSearchQuery,
        sourceHierarchyRelation: string, labelRelation,
        sourceGraph: Rdf.Iri): { rootsQuery, childrenQuery, parentsQuery, searchQuery } {

        const MULTILINE_COMMENT = /\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm;
        let rootsQuery = queries.rootsQuery;
        let childrenQuery = queries.childrenQuery;
        let parentsQuery = queries.parentsQuery;
        let searchQuery = queries.searchQuery;

        rootsQuery = rootsQuery.replace(MULTILINE_COMMENT, ""); //remove everything inside /**/
        rootsQuery = rootsQuery.replace(/__prefices__/g, prefices);
        rootsQuery = rootsQuery.replace(/__graph__/g, "<" + sourceGraph.value + ">");
        rootsQuery = rootsQuery.replace(/__typeRelation__/g, typeRelation);
        rootsQuery = rootsQuery.replace(/__typesRootQuery__/g, typesRootQuery);
        rootsQuery = rootsQuery.replace(/__parentshipRelation__/g, sourceHierarchyRelation);
        rootsQuery = rootsQuery.replace(/__labelRelation__/g, labelRelation);
        //rootsQuery = rootsQuery.replace(/__preferredLangs__/g, AlignmentRDF.createPreferredLangsSPARQLSection(undefined, "item", "labelX", "itemY", "labelY"));
        //rootsQuery = rootsQuery.replace(/__preferredLangs__/g, AlignmentRDF.createPreferredLangsSPARQLSection2(undefined, "item", "labelX", "itemY", "labelY","langY"));
        rootsQuery = rootsQuery.replace(/__preferredLangs__/g, AlignmentRDF.createFilterPreferredLangsSPARQLSection("labelX"));

        childrenQuery = childrenQuery.replace(MULTILINE_COMMENT, "");
        childrenQuery = childrenQuery.replace(/__prefices__/g, prefices);
        childrenQuery = childrenQuery.replace(/__graph__/g, "<" + sourceGraph.value + ">");
        //childrenQuery = childrenQuery.replace(/__sourceGraph__/g, "<" + sourceGraph.value + ">");
        childrenQuery = childrenQuery.replace(/__typeRelation__/g, typeRelation);
        childrenQuery = childrenQuery.replace(/__typesChildrenQuery__/g, typesChildrenQuery);
        childrenQuery = childrenQuery.replace(/__parentshipRelation__/g, sourceHierarchyRelation);
        childrenQuery = childrenQuery.replace(/__labelRelation__/g, labelRelation);
        //childrenQuery = childrenQuery.replace(/__preferredLangs__/g, AlignmentRDF.createPreferredLangsSPARQLSection(undefined, "item", "labelX", "itemY", "labelY"));
        //childrenQuery = childrenQuery.replace(/__preferredLangs__/g, AlignmentRDF.createPreferredLangsSPARQLSection2(undefined, "item", "labelX", "itemY", "labelY", "langY"));
        childrenQuery = childrenQuery.replace(/__preferredLangs__/g, AlignmentRDF.createFilterPreferredLangsSPARQLSection("labelX"));

        parentsQuery = parentsQuery.replace(MULTILINE_COMMENT, "");
        parentsQuery = parentsQuery.replace(/__prefices__/g, prefices);
        parentsQuery = parentsQuery.replace(/__graph__/g, "<" + sourceGraph.value + ">");
        parentsQuery = parentsQuery.replace(/__typeRelation__/g, typeRelation);
        parentsQuery = parentsQuery.replace(/__typesParentQuery__/g, typesParentQuery);
        parentsQuery = parentsQuery.replace(/__parentshipRelation__/g, sourceHierarchyRelation);
        parentsQuery = parentsQuery.replace(/__labelRelation__/g, labelRelation);

        searchQuery = searchQuery.replace(MULTILINE_COMMENT, "");
        searchQuery = searchQuery.replace(/__prefices__/g, prefices);
        searchQuery = searchQuery.replace(/__graph__/g, "<" + sourceGraph.value + ">");
        searchQuery = searchQuery.replace(/__typeRelation__/g, typeRelation);
        searchQuery = searchQuery.replace(/__typesSearchQuery__/g, typesSearchQuery);
        searchQuery = searchQuery.replace(/__parentshipRelation__/g, sourceHierarchyRelation);
        searchQuery = searchQuery.replace(/__labelRelation__/g, labelRelation);

        return {
            rootsQuery: rootsQuery,
            childrenQuery: childrenQuery,
            parentsQuery: parentsQuery,
            searchQuery: searchQuery
        };
    }


    export function constructTargetQueries(NGIri: Rdf.Iri, queries, prefices,
        typeRelation, typesRootQuery, typesParentQuery, typesChildrenQuery, typesSearchQuery,
        targetHierarchyRelation: string, labelRelation,
        exactMatchAlignmentRelation, closeMatchAlignmentRelation, relatedMatchAlignmentRelation, broadMatchAlignmentRelation, broaderAlignmentRelation,
        sourceGraph: Rdf.Iri, targetGraph: Rdf.Iri): { rootsQuery, childrenQuery, parentsQuery, searchQuery } {

        const COMMENT_MARKS = /\/\*(.*?)\*\//g;
        let rootsQuery = queries.rootsQuery;
        let childrenQuery = queries.childrenQuery;
        let parentsQuery = queries.parentsQuery;
        let searchQuery = queries.searchQuery;


        rootsQuery = rootsQuery.replace(COMMENT_MARKS, "$1"); //remove /* and */
        rootsQuery = rootsQuery.replace(/__prefices__/g, prefices);
        rootsQuery = rootsQuery.replace(/__graph__/g, "<" + targetGraph.value + ">");
        rootsQuery = rootsQuery.replace(/__alignmentGraph__/g, "<" + NGIri.value + ">");
        rootsQuery = rootsQuery.replace(/__exactMatchAlignmentRelation__/g, exactMatchAlignmentRelation);
        rootsQuery = rootsQuery.replace(/__closeMatchAlignmentRelation__/g, closeMatchAlignmentRelation);
        rootsQuery = rootsQuery.replace(/__relatedMatchAlignmentRelation__/g, relatedMatchAlignmentRelation);
        rootsQuery = rootsQuery.replace(/__broadMatchAlignmentRelation__/g, broadMatchAlignmentRelation);
        rootsQuery = rootsQuery.replace(/__broaderAlignmentRelation__/g, broaderAlignmentRelation);

        rootsQuery = rootsQuery.replace(/__typeRelation__/g, typeRelation);
        rootsQuery = rootsQuery.replace(/__typesRootQuery__/g, typesRootQuery);
        rootsQuery = rootsQuery.replace(/__parentshipRelation__/g, targetHierarchyRelation);
        rootsQuery = rootsQuery.replace(/__labelRelation__/g, labelRelation);
        //rootsQuery = rootsQuery.replace(/__preferredLangs__/g, AlignmentRDF.createPreferredLangsSPARQLSection(undefined, "item", "labelX", "itemY", "labelY"));
        //rootsQuery = rootsQuery.replace(/__preferredLangs__/g, AlignmentRDF.createPreferredLangsSPARQLSection(undefined, "item", "labelX", "itemY", "labelY", "langY"));
        rootsQuery = rootsQuery.replace(/__preferredLangs__/g, AlignmentRDF.createFilterPreferredLangsSPARQLSection("labelX"));

        childrenQuery = childrenQuery.replace(COMMENT_MARKS, "$1");
        childrenQuery = childrenQuery.replace(/__prefices__/g, prefices);
        childrenQuery = childrenQuery.replace(/__graph__ /g, "<" + targetGraph.value + ">");
        childrenQuery = childrenQuery.replace(/__alignmentGraph__/g, "<" + NGIri.value + ">");
        childrenQuery = childrenQuery.replace(/__sourceGraph__/g, "<" + sourceGraph.value + ">");
        childrenQuery = childrenQuery.replace(/__exactMatchAlignmentRelation__/g, exactMatchAlignmentRelation);
        childrenQuery = childrenQuery.replace(/__closeMatchAlignmentRelation__/g, closeMatchAlignmentRelation);
        childrenQuery = childrenQuery.replace(/__relatedMatchAlignmentRelation__/g, relatedMatchAlignmentRelation);
        childrenQuery = childrenQuery.replace(/__broadMatchAlignmentRelation__/g, broadMatchAlignmentRelation);
        childrenQuery = childrenQuery.replace(/__broaderAlignmentRelation__/g, broaderAlignmentRelation);
        childrenQuery = childrenQuery.replace(/__typeRelation__/g, typeRelation);
        childrenQuery = childrenQuery.replace(/__typesChildrenQuery__/g, typesChildrenQuery);
        childrenQuery = childrenQuery.replace(/__parentshipRelation__/g, targetHierarchyRelation);
        childrenQuery = childrenQuery.replace(/__labelRelation__/g, labelRelation);
        //childrenQuery = childrenQuery.replace(/__preferredLangs__/g, AlignmentRDF.createPreferredLangsSPARQLSection(sourceGraph, "item", "labelX", "itemY", "labelY"));
        //childrenQuery = childrenQuery.replace(/__preferredLangs__/g, AlignmentRDF.createPreferredLangsSPARQLSection2(sourceGraph, "item", "labelX", "itemY", "labelY", "langY"));
        childrenQuery = childrenQuery.replace(/__preferredLangs__/g, AlignmentRDF.createFilterPreferredLangsSPARQLSection("labelX"));

        parentsQuery = parentsQuery.replace(COMMENT_MARKS, "$1");
        parentsQuery = parentsQuery.replace(/__prefices__/g, prefices);
        parentsQuery = parentsQuery.replace(/__graph__/g, "<" + targetGraph.value + ">");
        parentsQuery = parentsQuery.replace(/__exactMatchAlignmentRelation__/g, exactMatchAlignmentRelation);
        parentsQuery = parentsQuery.replace(/__closeMatchAlignmentRelation__/g, closeMatchAlignmentRelation);
        parentsQuery = parentsQuery.replace(/__relatedMatchAlignmentRelation__/g, relatedMatchAlignmentRelation);
        parentsQuery = parentsQuery.replace(/__broadMatchAlignmentRelation__/g, broadMatchAlignmentRelation);
        parentsQuery = parentsQuery.replace(/__broaderAlignmentRelation__/g, broaderAlignmentRelation);
        parentsQuery = parentsQuery.replace(/__typeRelation__/g, typeRelation);
        parentsQuery = parentsQuery.replace(/__typesParentQuery__/g, typesParentQuery);
        parentsQuery = parentsQuery.replace(/__parentshipRelation__/g, targetHierarchyRelation);
        parentsQuery = parentsQuery.replace(/__labelRelation__/g, labelRelation);

        searchQuery = searchQuery.replace(COMMENT_MARKS, "$1");
        searchQuery = searchQuery.replace(/__prefices__/g, prefices);
        searchQuery = searchQuery.replace(/__graph__/g, "<" + targetGraph.value + ">");
        searchQuery = searchQuery.replace(/__alignmentGraph__/g, "<" + NGIri.value + ">");
        searchQuery = searchQuery.replace(/__exactMatchAlignmentRelation__/g, exactMatchAlignmentRelation);
        searchQuery = searchQuery.replace(/__closeMatchAlignmentRelation__/g, closeMatchAlignmentRelation);
        searchQuery = searchQuery.replace(/__relatedMatchAlignmentRelation__/g, relatedMatchAlignmentRelation);
        searchQuery = searchQuery.replace(/__broadMatchAlignmentRelation__/g, broadMatchAlignmentRelation);
        searchQuery = searchQuery.replace(/__broaderAlignmentRelation__/g, broaderAlignmentRelation);
        searchQuery = searchQuery.replace(/__typeRelation__/g, typeRelation);
        searchQuery = searchQuery.replace(/__typesSearchQuery__/g, typesSearchQuery);
        searchQuery = searchQuery.replace(/__parentshipRelation__/g, targetHierarchyRelation);
        searchQuery = searchQuery.replace(/__labelRelation__/g, labelRelation);

        return {
            rootsQuery: rootsQuery,
            childrenQuery: childrenQuery,
            parentsQuery: parentsQuery,
            searchQuery: searchQuery
        };
    }

}