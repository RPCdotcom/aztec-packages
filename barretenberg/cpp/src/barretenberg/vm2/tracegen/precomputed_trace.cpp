#include "barretenberg/vm2/tracegen/precomputed_trace.hpp"

#include <cstddef>
#include <cstdint>

namespace bb::avm2::tracegen {

void PrecomputedTraceBuilder::process_misc(TraceContainer& trace)
{
    using C = Column;

    // First row.
    trace.set(C::precomputed_first_row, 0, 1);

    // Clk.
    // TODO: What a waste of 64MB. Can we elegantly have a flag for this?
    constexpr size_t circuit_size = 1 << 21; // TODO: Move somewhere else.
    for (size_t i = 0; i < circuit_size; i++) {
        trace.set(C::precomputed_clk, i, i);
    }
}

void PrecomputedTraceBuilder::process_bitwise(TraceContainer& trace)
{
    using C = Column;

    size_t row = 0;
    // AND
    for (size_t a = 0; a < 256; a++) {
        for (size_t b = 0; b < 256; b++) {
            trace.set(row,
                      { {
                          { C::precomputed_sel_bitwise, 1 },
                          { C::precomputed_bitwise_input_a, FF(a) },
                          { C::precomputed_bitwise_input_b, FF(b) },
                          { C::precomputed_bitwise_output, FF(a & b) },
                      } });
            row++;
        }
    }
    // OR
    for (size_t a = 0; a < 256; a++) {
        for (size_t b = 0; b < 256; b++) {
            trace.set(row,
                      { {
                          { C::precomputed_sel_bitwise, 1 },
                          { C::precomputed_bitwise_input_a, FF(a) },
                          { C::precomputed_bitwise_input_b, FF(b) },
                          { C::precomputed_bitwise_output, FF(a | b) },
                      } });
            row++;
        }
    }
    // XOR
    for (size_t a = 0; a < 256; a++) {
        for (size_t b = 0; b < 256; b++) {
            trace.set(row,
                      { {
                          { C::precomputed_sel_bitwise, 1 },
                          { C::precomputed_bitwise_input_a, FF(a) },
                          { C::precomputed_bitwise_input_b, FF(b) },
                          { C::precomputed_bitwise_output, FF(a ^ b) },
                      } });
            row++;
        }
    }
}

} // namespace bb::avm2::tracegen