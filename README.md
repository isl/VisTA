# VisTA
Visual Terminology Alignment


The Visual Terminology Alignment tool, can be used for making target-driven alignments of terms taken form a source terminology, to a target terminology. The result is an alignment graph, containing
a. the sub-ordination of source-term sub-hierarchies under target-terms, and
b. the correlation of single source-terms to target-terms,
using the SKOS matching relations: skos:exactMatch, skos:broadMatch, skos:closeMatch, and skos:relatedMatch.

Details about how the tool works can be found in VisTA/researchspace/web/src/main/terminology-alignment/doc

#
The implementation of the tool is based on the metaphacts v2.0 platform (https://metaphacts.com/) and the ResearchSpace app (https://www.researchspace.org/). The source code of the tool resides in researchspace/web/src/main/terminology-alignment.

# Demo
A demo version is running at:		 https://vista.isl.ics.forth.gr
User account for testing: guest/guest. User 'guest' is a readonly account that cannot make changes to the triple store.


